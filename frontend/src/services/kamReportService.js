import api from "./api";

/** KAM onboarding vs churn report (billing-period metrics). */
export const kamReportService = {
  getKamGrowthChurn: (params) =>
    api.get("/bills/analytics/kam/growth-churn/", { params }),
};
