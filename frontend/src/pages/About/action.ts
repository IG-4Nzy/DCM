// @ts-nocheck
import request from "../../services/request";

export const fetchAboutDetails = async () => {
    return request.get("/api/about/");
};

export const updateAboutDetails = async (payload: any) => {
    return request.put("/api/about/", payload);
};

export const fetchBugReports = async () => {
    return request.get("/api/about/bug-reports");
};

export const deleteBugReport = async (id: str) => {
    return request.delete(`/api/about/bug-reports/${id}`);
};

export const reportBug = async (formData: FormData) => {
    return request.post("/api/about/bug-reports", formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};
