import { useState, useEffect, ChangeEvent } from "react";

export function useImageUpload() {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!imageFile) {
            setImagePreview(undefined);
            return;
        }

        const objectUrl = URL.createObjectURL(imageFile);
        setImagePreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [imageFile]);

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        setImageFile(file);
    };

    const resetImage = () => {
        setImageFile(null);
        setImagePreview(undefined);
    };

    return {
        imageFile,
        imagePreview,
        handleImageChange,
        resetImage,
        setImagePreview, // For setting initial preview from existing data
    };
}
