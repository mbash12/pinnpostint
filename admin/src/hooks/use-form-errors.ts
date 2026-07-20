import { useState, useCallback } from "react";
import { validateField, validateForm, ValidationSchema } from "@/utils/validation";

export function useFormErrors() {
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const clearError = useCallback((field: string) => {
        setFieldErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
        });
    }, []);

    const setError = useCallback((field: string, message: string) => {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
    }, []);

    const setErrors = useCallback((errors: Record<string, string>) => {
        setFieldErrors(errors);
    }, []);

    const clearAllErrors = useCallback(() => {
        setFieldErrors({});
    }, []);

    const validateFieldValue = useCallback((field: string, value: any, schema: ValidationSchema) => {
        if (schema[field]) {
            const error = validateField(value, schema[field]);
            if (error) {
                setError(field, error);
                return false;
            } else {
                clearError(field);
                return true;
            }
        }
        return true;
    }, [setError, clearError]);

    const validateFormData = useCallback((data: Record<string, any>, schema: ValidationSchema) => {
        const errors = validateForm(data, schema);
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    }, []);

    const handleApiError = useCallback((error: any) => {
        if (error?.error?.details && Array.isArray(error.error.details)) {
            const errors: Record<string, string> = {};
            error.error.details.forEach((detail: any) => {
                if (detail.field && detail.message) {
                    errors[detail.field] = detail.message;
                }
            });
            setFieldErrors(errors);
            return errors;
        }
        return null;
    }, []);

    return {
        fieldErrors,
        clearError,
        setError,
        setErrors,
        clearAllErrors,
        validateFieldValue,
        validateFormData,
        handleApiError,
    };
}
