import { useState } from "react";
import { AlertDialog } from "@/components/application/modals/alert-dialog";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertState {
    isOpen: boolean;
    title: string;
    description: string;
    type: AlertType;
}

export function useFormAlert() {
    const [alertDialog, setAlertDialog] = useState<AlertState>({
        isOpen: false,
        title: "",
        description: "",
        type: "info",
    });

    const showAlert = (title: string, description: string, type: AlertType = "info") => {
        setAlertDialog({ isOpen: true, title, description, type });
    };

    const closeAlert = () => {
        setAlertDialog((prev) => ({ ...prev, isOpen: false }));
    };

    const AlertComponent = () => {
        return (
            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={closeAlert}
                title={alertDialog.title}
                description={alertDialog.description}
                type={alertDialog.type}
            />
        );
    };

    return { showAlert, closeAlert, AlertComponent };
}
