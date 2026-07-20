import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { CreateLegalDocumentRequest, UpdateLegalDocumentRequest } from "@/lib/api-types";

export const useLegalDocuments = (isAdmin: boolean = true) => {
    return useQuery({
        queryKey: ["legal-documents", isAdmin],
        queryFn: async () => {
            const response = await apiClient.getLegalDocuments(isAdmin);
            return response.data;
        },
    });
};

export const useLegalDocument = (id: string) => {
    return useQuery({
        queryKey: ["legal-document", id],
        queryFn: async () => {
            const response = await apiClient.getLegalDocument(id);
            return response.data;
        },
        enabled: !!id && id !== "create",
    });
};

export const useCreateLegalDocument = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateLegalDocumentRequest) => {
            const response = await apiClient.createLegalDocument(data);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
        },
    });
};

export const useUpdateLegalDocument = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: UpdateLegalDocumentRequest }) => {
            const response = await apiClient.updateLegalDocument(id, data);
            return response;
        },
        onSuccess: (response) => {
            if (response?.data) {
                const document = response.data;
                queryClient.setQueryData(["legal-document", document.id], document);
                queryClient.setQueryData(["legal-documents"], (oldData: any) => {
                    if (!oldData) return oldData;
                    return {
                        ...oldData,
                        data: oldData.data?.map((doc: any) => doc.id === document.id ? document : doc),
                    };
                });
            }
        },
    });
};

export const useDeleteLegalDocument = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await apiClient.deleteLegalDocument(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
        },
    });
};
