interface ToggleFieldProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function ToggleField({ label, description, checked, onChange, disabled = false }: ToggleFieldProps) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-secondary bg-secondary p-4">
            <div>
                <p className="text-sm font-semibold text-primary">{label}</p>
                <p className="text-xs text-tertiary">{description}</p>
            </div>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
            />
        </label>
    );
}
