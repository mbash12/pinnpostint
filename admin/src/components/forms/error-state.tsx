interface ErrorStateProps {
    message?: string;
}

export function ErrorState({ message = "Resource not found" }: ErrorStateProps) {
    return (
        <div className="flex items-center justify-center min-h-96">
            <div className="text-error">{message}</div>
        </div>
    );
}
