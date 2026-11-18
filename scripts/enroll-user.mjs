import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function enrollUser(email, name = "Enterprise Administrator") {
  if (!email) {
    console.error("Usage: node scripts/enroll-user.mjs <email> [name]");
    process.exit(1);
  }

  const T_A = "00000000-0000-4000-8000-0000000000aa"; // Acme Corp
  const normalizedEmail = email.toLowerCase().trim();

  let user = await prisma.authUser.findFirst({
    where: { tenantId: T_A, email: normalizedEmail },
  });

  if (!user) {
    user = await prisma.authUser.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: T_A,
        email: normalizedEmail,
        isRootAdmin: true,
        isSuperadmin: true,
      },
    });
    console.log(`Created AuthUser ${user.id} for ${normalizedEmail}`);
  } else {
    user = await prisma.authUser.update({
      where: { id: user.id },
      data: { isRootAdmin: true, isSuperadmin: true },
    });
    console.log(`Updated AuthUser ${user.id} for ${normalizedEmail}`);
  }

  let employee = await prisma.employee.findFirst({
    where: { tenantId: T_A, workEmail: normalizedEmail },
  });

  if (!employee) {
    employee = await prisma.employee.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: T_A,
        userId: user.id,
        displayName: name,
        workEmail: normalizedEmail,
        jobTitle: "Enterprise Superadmin",
        department: "Executive",
        employmentStatus: "active",
      },
    });
    console.log(`Created Employee ${employee.id} for ${normalizedEmail}`);
  } else {
    employee = await prisma.employee.update({
      where: { id: employee.id },
      data: { userId: user.id, displayName: name },
    });
  }

  const membership = await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: { tenantId: T_A, userId: user.id },
    },
    update: {
      employeeId: employee.id,
      status: "active",
    },
    create: {
      tenantId: T_A,
      userId: user.id,
      employeeId: employee.id,
      status: "active",
    },
  });

  console.log(`Enrolled ${normalizedEmail} successfully with active membership ${membership.id}`);
}

enrollUser(process.argv[2], process.argv[3])
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
