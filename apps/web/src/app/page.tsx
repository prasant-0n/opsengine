import { Metadata } from "next";
import LandingPageView from "./landing-page-view";

export const metadata: Metadata = {
  title: "OpsEngine — Enterprise Operations, Workforce & SaaS Execution Operating System",
  description:
    "The all-in-one business OS for software and services firms: Multi-tenant CRM, Project Workforce, Darwinbox-grade HRMS, Financial Reconciliations, and Autonomous Operations.",
};

export default function LandingPage() {
  return <LandingPageView />;
}
