interface LoadingStateProps {
    message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
    return (
        <div className="flex items-center justify-center min-h-96">
            <div className="text-primary">{message}</div>
        </div>
    );
}
