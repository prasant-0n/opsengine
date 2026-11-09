export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  tags: Array<{
    name: string;
    description: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  security: Array<Record<string, string[]>>;
}

export function generateOpenApiSpec(): OpenApiSpec {
  return {
    openapi: "3.1.0",
    info: {
      title: "OpsEngine Enterprise SaaS Platform API",
      version: "1.0.0",
      description:
        "Comprehensive REST API contract for OpsEngine Multi-Tenant Enterprise Operations Platform. Encapsulates CRM, HRMS, Workforce Allocation, Finance, Approvals, ATS, Onboarding, Documents, Time Reporting, and SaaS Control Plane.",
      contact: {
        name: "OpsEngine API Platform Team",
        email: "api-support@opsengine.enterprise",
      },
      license: {
        name: "Proprietary",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local Development Server",
      },
      {
        url: "http://localhost:3001",
        description: "Alternative Test Dev Server",
      },
      {
        url: "https://api.opsengine.enterprise",
        description: "Production SaaS API Gateway",
      },
    ],
    tags: [
      { name: "Authentication", description: "Identity, session management, OTP, and password recovery" },
      { name: "Identity & ReBAC", description: "Authoritative user profile and ReBAC permissions evaluation" },
      { name: "SaaS Control Plane", description: "Tenant provisioning, workspace lifecycles, and plan subscriptions" },
      { name: "Organization & HRMS", description: "Employees, departments, teams, and hierarchical reporting lines" },
      { name: "Recruitment & ATS", description: "Job requisitions, applicant pipeline, candidate interviews, and feedback" },
      { name: "Onboarding & Induction", description: "New hire checklists, buddies, probation management, and policy sign-offs" },
      { name: "Time & Attendance", description: "Daily check-ins, time entries, attendance corrections, and leave applications" },
      { name: "Work & Projects", description: "Client delivery projects, sprint tickets, milestones, and workforce allocations" },
      { name: "CRM & Sales", description: "Accounts, contacts, sales leads, and deal opportunities pipeline" },
      { name: "Finance & Invoicing", description: "Commercial terms, invoice generation, line items, payments, and receivables" },
      { name: "Approval Workflows", description: "Configurable multi-step approval workflows, decisions, and delegations" },
      { name: "Documents & Storage", description: "Secure file repository, SHA-256 integrity verification, and signed download URLs" },
      { name: "Calendar & Meetings", description: "Enterprise calendar scheduling, attendee RSVPs, and live meeting notes" },
      { name: "Telemetry & Health", description: "Operational health probes, Prometheus metrics exposition, and latency telemetry" },
      { name: "Auditing & Reports", description: "Immutable security audit logs, executive summary KPIs, and compliance export jobs" },
      { name: "AI Assistant", description: "Controlled Gemini AI assistant interface with explicit human approval gates" },
    ],
    paths: {
      // 1. Authentication
      "/api/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Authenticate user and issue session cookie",
          operationId: "loginUser",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Authentication successful, session cookie set",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/LoginResponse" },
                },
              },
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Authentication"],
          summary: "Terminate active user session and clear cookies",
          operationId: "logoutUser",
          responses: {
            "200": {
              description: "Session successfully invalidated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { success: { type: "boolean", example: true } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/tenant-selector": {
        post: {
          tags: ["Authentication"],
          summary: "Discover tenant workspaces associated with email or domain",
          operationId: "resolveTenantWorkspaces",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["identifier"],
                  properties: { identifier: { type: "string", example: "alex@acme.corp" } },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "List of matching tenant workspaces",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workspaces: {
                        type: "array",
                        items: { $ref: "#/components/schemas/TenantWorkspace" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 2. Identity & ReBAC
      "/api/authz/whoami": {
        get: {
          tags: ["Identity & ReBAC"],
          summary: "Retrieve current authenticated subject context and permissions",
          operationId: "getWhoAmI",
          responses: {
            "200": {
              description: "Current subject profile and permissions",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WhoAmIResponse" },
                },
              },
            },
            "401": {
              description: "Unauthenticated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      // 3. SaaS Control Plane
      "/api/control-plane/workspaces": {
        get: {
          tags: ["SaaS Control Plane"],
          summary: "List all tenant workspaces across the platform",
          operationId: "listWorkspaces",
          responses: {
            "200": {
              description: "Tenant workspaces list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workspaces: {
                        type: "array",
                        items: { $ref: "#/components/schemas/TenantWorkspace" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/control-plane/workspaces/{id}/lifecycle": {
        patch: {
          tags: ["SaaS Control Plane"],
          summary: "Update workspace lifecycle state (active, suspended, offboarded)",
          operationId: "updateWorkspaceLifecycle",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["lifecycleStatus"],
                  properties: {
                    lifecycleStatus: { type: "string", enum: ["active", "suspended", "offboarded"] },
                    suspendedReason: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Lifecycle status updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TenantWorkspace" },
                },
              },
            },
          },
        },
      },
      // 4. Organization & HRMS
      "/api/org/employees": {
        get: {
          tags: ["Organization & HRMS"],
          summary: "List tenant employees with filtering by department or status",
          operationId: "listEmployees",
          parameters: [
            { name: "department", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", default: "active" } },
          ],
          responses: {
            "200": {
              description: "Filtered employee directory",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      employees: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Employee" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/org/employees/{id}": {
        get: {
          tags: ["Organization & HRMS"],
          summary: "Get detailed employee profile by ID",
          operationId: "getEmployeeById",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          responses: {
            "200": {
              description: "Employee profile details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Employee" },
                },
              },
            },
            "404": {
              description: "Employee not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      // 5. Recruitment & ATS
      "/api/ats/requisitions": {
        get: {
          tags: ["Recruitment & ATS"],
          summary: "List job requisitions with headcount and status",
          operationId: "listJobRequisitions",
          responses: {
            "200": {
              description: "List of job openings",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      requisitions: {
                        type: "array",
                        items: { $ref: "#/components/schemas/JobRequisition" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Recruitment & ATS"],
          summary: "Create a new job requisition",
          operationId: "createJobRequisition",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "department", "targetCount"],
                  properties: {
                    title: { type: "string", example: "Senior Backend Engineer" },
                    department: { type: "string", example: "Engineering" },
                    targetCount: { type: "integer", example: 2 },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Requisition created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/JobRequisition" },
                },
              },
            },
          },
        },
      },
      "/api/ats/candidates": {
        get: {
          tags: ["Recruitment & ATS"],
          summary: "List candidate applicants across requisition pipelines",
          operationId: "listCandidates",
          responses: {
            "200": {
              description: "List of candidates",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      candidates: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Candidate" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 6. Onboarding
      "/api/onboarding/plans": {
        get: {
          tags: ["Onboarding & Induction"],
          summary: "List active new-hire onboarding plans",
          operationId: "listOnboardingPlans",
          responses: {
            "200": {
              description: "Onboarding plans list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      plans: {
                        type: "array",
                        items: { $ref: "#/components/schemas/OnboardingPlan" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 7. Time & Attendance
      "/api/time/entries": {
        get: {
          tags: ["Time & Attendance"],
          summary: "List time entries for employee and date range",
          operationId: "listTimeEntries",
          responses: {
            "200": {
              description: "Recorded work logs",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      entries: {
                        type: "array",
                        items: { $ref: "#/components/schemas/TimeEntry" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/leave/requests": {
        get: {
          tags: ["Time & Attendance"],
          summary: "List employee leave applications",
          operationId: "listLeaveRequests",
          responses: {
            "200": {
              description: "List of leave requests",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      requests: {
                        type: "array",
                        items: { $ref: "#/components/schemas/LeaveRequest" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 8. Work & Projects
      "/api/projects": {
        get: {
          tags: ["Work & Projects"],
          summary: "List delivery projects and client engagements",
          operationId: "listProjects",
          responses: {
            "200": {
              description: "Project listings",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      projects: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Project" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/tickets": {
        get: {
          tags: ["Work & Projects"],
          summary: "List sprint tickets and work tasks",
          operationId: "listTickets",
          parameters: [
            { name: "projectId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "status", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Ticket issues list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      tickets: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Ticket" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 9. CRM & Sales
      "/api/crm/accounts": {
        get: {
          tags: ["CRM & Sales"],
          summary: "List corporate client accounts",
          operationId: "listCrmAccounts",
          responses: {
            "200": {
              description: "CRM Accounts list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      accounts: {
                        type: "array",
                        items: { $ref: "#/components/schemas/CrmAccount" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/crm/opportunities": {
        get: {
          tags: ["CRM & Sales"],
          summary: "List sales pipeline opportunities",
          operationId: "listOpportunities",
          responses: {
            "200": {
              description: "Sales opportunities list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      opportunities: {
                        type: "array",
                        items: { $ref: "#/components/schemas/CrmOpportunity" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 10. Finance & Invoicing
      "/api/finance/invoices": {
        get: {
          tags: ["Finance & Invoicing"],
          summary: "List invoices, status, totals, and balances",
          operationId: "listInvoices",
          responses: {
            "200": {
              description: "Invoices list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      invoices: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Invoice" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 11. Approvals
      "/api/approvals/instances": {
        get: {
          tags: ["Approval Workflows"],
          summary: "List approval instances pending decision or historical record",
          operationId: "listApprovalInstances",
          responses: {
            "200": {
              description: "Approval instances list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      instances: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ApprovalInstance" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 12. Documents
      "/api/documents": {
        get: {
          tags: ["Documents & Storage"],
          summary: "List uploaded files with SHA-256 checksums and mime types",
          operationId: "listDocuments",
          responses: {
            "200": {
              description: "Documents metadata list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      documents: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DocumentItem" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 13. Calendar & Meetings
      "/api/calendar/events": {
        get: {
          tags: ["Calendar & Meetings"],
          summary: "List calendar meetings and attendee RSVPs",
          operationId: "listCalendarEvents",
          responses: {
            "200": {
              description: "Events list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      events: {
                        type: "array",
                        items: { $ref: "#/components/schemas/CalendarEvent" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 14. Telemetry & Health
      "/api/health": {
        get: {
          tags: ["Telemetry & Health"],
          summary: "Readiness probe verifying DB connectivity and system health",
          operationId: "getHealthProbe",
          responses: {
            "200": {
              description: "Service is healthy and operational",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthStatus" },
                },
              },
            },
            "503": {
              description: "Service is degraded or database is unreachable",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthStatus" },
                },
              },
            },
          },
        },
      },
      "/api/metrics": {
        get: {
          tags: ["Telemetry & Health"],
          summary: "Prometheus standard text format metrics scraper",
          operationId: "getPrometheusMetrics",
          responses: {
            "200": {
              description: "Prometheus plaintext metrics exposition",
              content: {
                "text/plain; version=0.0.4; charset=utf-8": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      // 15. Auditing & Reports
      "/api/reports/audit-events": {
        get: {
          tags: ["Auditing & Reports"],
          summary: "Query immutable tenant security audit event logs",
          operationId: "listAuditEvents",
          responses: {
            "200": {
              description: "Audit trail events",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      events: {
                        type: "array",
                        items: { $ref: "#/components/schemas/AuditEvent" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // 16. AI Assistant
      "/api/assistant/chat": {
        post: {
          tags: ["AI Assistant"],
          summary: "Interact with the controlled Enterprise AI Assistant",
          operationId: "assistantChat",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: { message: { type: "string", example: "Summarize sprint status" } },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "AI response with citations and proposed actions",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      reply: { type: "string" },
                      proposedActions: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        SessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "ops_session",
          description: "HttpOnly session cookie issued by /api/auth/login",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "API bearer token for programmatic automation",
        },
        TenantContext: {
          type: "apiKey",
          in: "header",
          name: "x-tenant-id",
          description: "Authoritative tenant UUID for multi-tenant simulation",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string", example: "Unauthorized or invalid credentials" },
            code: { type: "string", example: "INVALID_CREDENTIALS" },
            message: { type: "string", example: "Detailed error description" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password", "domain"],
          properties: {
            domain: { type: "string", example: "acme.opsengine.enterprise" },
            email: { type: "string", format: "email", example: "alex@acme.corp" },
            password: { type: "string", format: "password", example: "Sup3rSecret!" },
            rememberMe: { type: "boolean", default: false },
          },
        },
        LoginResponse: {
          type: "object",
          required: ["sessionToken", "tenantId", "userId", "role", "expiresAt"],
          properties: {
            sessionToken: { type: "string" },
            tenantId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            role: { type: "array", items: { type: "string" } },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
        WhoAmIResponse: {
          type: "object",
          required: ["userId", "tenantId", "email", "permissions"],
          properties: {
            userId: { type: "string", format: "uuid" },
            tenantId: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            permissions: { type: "array", items: { type: "string" } },
          },
        },
        TenantWorkspace: {
          type: "object",
          required: ["id", "tenantId", "name", "slug", "lifecycle_status"],
          properties: {
            id: { type: "string", format: "uuid" },
            tenantId: { type: "string", format: "uuid" },
            name: { type: "string", example: "Acme Corp" },
            slug: { type: "string", example: "acme.opsengine.enterprise" },
            domain: { type: "string", example: "acme.opsengine.enterprise" },
            lifecycle_status: { type: "string", enum: ["active", "suspended", "offboarded"] },
          },
        },
        Employee: {
          type: "object",
          required: ["id", "tenant_id", "display_name", "employment_status"],
          properties: {
            id: { type: "string", format: "uuid" },
            tenant_id: { type: "string", format: "uuid" },
            display_name: { type: "string", example: "Sarah Jenkins" },
            job_title: { type: "string", example: "SBU Head" },
            department: { type: "string", example: "Engineering" },
            employment_status: { type: "string", example: "active" },
          },
        },
        JobRequisition: {
          type: "object",
          required: ["id", "title", "department", "targetCount"],
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Principal Architect" },
            department: { type: "string", example: "Engineering" },
            targetCount: { type: "integer", example: 1 },
          },
        },
        Candidate: {
          type: "object",
          required: ["id", "name", "stage"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Alice Walker" },
            stage: { type: "string", example: "TECHNICAL_INTERVIEW" },
          },
        },
        OnboardingPlan: {
          type: "object",
          required: ["id", "employeeId", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            employeeId: { type: "string", format: "uuid" },
            status: { type: "string", example: "IN_PROGRESS" },
          },
        },
        TimeEntry: {
          type: "object",
          required: ["id", "durationMinutes", "taskDescription"],
          properties: {
            id: { type: "string", format: "uuid" },
            durationMinutes: { type: "integer", example: 120 },
            taskDescription: { type: "string", example: "API Documentation generation" },
          },
        },
        LeaveRequest: {
          type: "object",
          required: ["id", "leaveTypeId", "startDate", "endDate", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            leaveTypeId: { type: "string", format: "uuid" },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            status: { type: "string", example: "APPROVED" },
          },
        },
        Project: {
          type: "object",
          required: ["id", "name", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Project Apollo" },
            status: { type: "string", example: "ACTIVE" },
            budget_cents: { type: "integer", example: 50000000 },
          },
        },
        Ticket: {
          type: "object",
          required: ["id", "title", "status", "priority"],
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "APOLLO-101: Configure telemetry" },
            status: { type: "string", example: "IN_PROGRESS" },
            priority: { type: "string", example: "HIGH" },
          },
        },
        CrmAccount: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Nexus Global Logistics" },
            industry: { type: "string", example: "Logistics" },
          },
        },
        CrmOpportunity: {
          type: "object",
          required: ["id", "title", "valueCents", "stage"],
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Nexus Core Fleet Modernization" },
            valueCents: { type: "integer", example: 75000000 },
            stage: { type: "string", example: "PROPOSAL_REVIEW" },
          },
        },
        Invoice: {
          type: "object",
          required: ["id", "invoiceNumber", "totalAmountCents", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            invoiceNumber: { type: "string", example: "INV-2026-001" },
            totalAmountCents: { type: "integer", example: 2500000 },
            status: { type: "string", example: "ISSUED" },
          },
        },
        ApprovalInstance: {
          type: "object",
          required: ["id", "workflowId", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            workflowId: { type: "string", format: "uuid" },
            status: { type: "string", example: "PENDING" },
          },
        },
        DocumentItem: {
          type: "object",
          required: ["id", "filename", "sha256Hash"],
          properties: {
            id: { type: "string", format: "uuid" },
            filename: { type: "string", example: "ISO_27001_Compliance_Manual.pdf" },
            sha256Hash: { type: "string", example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
          },
        },
        CalendarEvent: {
          type: "object",
          required: ["id", "title", "startTime", "endTime"],
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Q4 Executive Strategic Review" },
            startTime: { type: "string", format: "date-time" },
            endTime: { type: "string", format: "date-time" },
          },
        },
        HealthStatus: {
          type: "object",
          required: ["status", "timestamp", "database"],
          properties: {
            status: { type: "string", enum: ["healthy", "degraded"] },
            timestamp: { type: "string", format: "date-time" },
            uptimeSeconds: { type: "integer" },
            traceId: { type: "string" },
            database: {
              type: "object",
              properties: {
                status: { type: "string" },
                latencyMs: { type: "number" },
              },
            },
          },
        },
        AuditEvent: {
          type: "object",
          required: ["id", "eventType", "action", "status", "created_at"],
          properties: {
            id: { type: "string", format: "uuid" },
            eventType: { type: "string", example: "authz.decision" },
            action: { type: "string", example: "document:read" },
            status: { type: "string", example: "SUCCESS" },
            created_at: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [
      {
        SessionCookie: [],
      },
    ],
  };
}
