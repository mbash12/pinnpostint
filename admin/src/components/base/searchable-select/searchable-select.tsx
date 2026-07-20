import { useState, useEffect, useRef } from "react";
import { SearchLg, ChevronDown, Loading02 } from "@untitledui/icons";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import { apiClient } from "@/lib/api-client";

interface SearchableSelectProps {
    label: string;
    placeholder: string;
    value?: string;
    onSelectionChange: (value: string) => void;
    searchFn: (query: string) => Promise<any[]>;
    displayKey: string;
    valueKey: string;
    isRequired?: boolean;
    selectedDisplayValue?: string; // Optional prop to display a pre-selected value
    fetchByIdFn?: (id: string) => Promise<any>; // Optional function to fetch item by ID
    renderOption?: (item: any) => React.ReactNode; // Custom render function for options
}

export function SearchableSelect({
    label,
    placeholder,
    value,
    onSelectionChange,
    searchFn,
    displayKey,
    valueKey,
    isRequired,
    selectedDisplayValue,
    fetchByIdFn,
    renderOption
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [options, setOptions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

    // Keep track of the previous value to detect when it changes
    const prevValueRef = useRef(value);
    const searchFnRef = useRef(searchFn);

    // Update the searchFn ref when it changes
    useEffect(() => {
        searchFnRef.current = searchFn;
    }, [searchFn]);

    // Clear selected item when value changes externally (e.g., when parent field changes)
    useEffect(() => {
        // If the value has changed from the previous value
        if (prevValueRef.current !== value) {
            // Clear the selected item if the new value is empty
            if (!value) {
                setSelectedItem(null);
                setSearchQuery("");
            } else if (value !== selectedItem?.[valueKey]) {
                // Value changed and doesn't match current selection, fetch the new item
                const fetchSelectedItem = async () => {
                    try {
                        // First try to find the item in the search results with empty query
                        let item = null;

                        // If we have a value (ID) but no matching item found in search results,
                        // try to fetch the specific item by its ID using dedicated endpoints
                        if (value) {
                            // Try to fetch the specific item by ID
                            // First, try to find in the search results with empty query
                            const results = await searchFnRef.current("");
                            item = results.find((r: any) => r[valueKey] === value);

                            // If not found in search results, try to fetch by ID using fetchByIdFn if provided
                            if (!item && fetchByIdFn) {
                                try {
                                    item = await fetchByIdFn(value);
                                } catch (err) {
                                    // Could not fetch item by ID using fetchByIdFn: ${value}, err
                                }
                            } else if (!item) {
                                // If no custom fetchByIdFn, try the default endpoints
                                try {
                                    // Try city endpoint first
                                    const cityResponse = await apiClient.getCityById(value);
                                    if (cityResponse.success && cityResponse.data) {
                                        item = cityResponse.data;
                                    }
                                } catch (err) {
                                    // If city failed, try postal code
                                    try {
                                        const postalResponse = await apiClient.getPostalCodeById(value);
                                        if (postalResponse.success && postalResponse.data) {
                                            item = postalResponse.data;
                                        }
                                    } catch (postalErr) {
                                        // Could not fetch location item by ID: ${value}, err, postalErr
                                    }
                                }
                            }
                        }

                        // If still no item found, create a temporary one with the ID as fallback
                        if (!item) {
                            item = { [valueKey]: value, [displayKey]: value }; // Show ID as fallback
                        }

                        setSelectedItem(item);
                    } catch (error) {
                        // Failed to fetch selected item: error
                        // Create a temporary item with the ID as fallback
                        setSelectedItem({ [valueKey]: value, [displayKey]: value });
                    }
                };
                fetchSelectedItem();
            }
            // Update the ref to the current value
            prevValueRef.current = value;
        }
    }, [value, valueKey, displayKey, selectedItem]);

    // Fetch options when search query changes or dropdown opens
    useEffect(() => {
        const fetchOptions = async () => {
            setIsLoading(true);
            try {
                const results = await searchFnRef.current(searchQuery);
                setOptions(results);
            } catch (error) {
                // Search failed: error
                setOptions([]);
            } finally {
                setIsLoading(false);
            }
        };

        // Only fetch when dropdown is open
        if (isOpen) {
            const debounceTimer = setTimeout(fetchOptions, 300);
            return () => clearTimeout(debounceTimer);
        }
    }, [searchQuery, isOpen]);

    // Clear options when dropdown closes to force refetch on next open
    useEffect(() => {
        if (!isOpen) {
            setOptions([]);
            setSearchQuery("");
        }
    }, [isOpen]);

    const handleSelect = (item: any) => {
        setSelectedItem(item);
        onSelectionChange(item[valueKey]);
        setIsOpen(false);
        setSearchQuery("");
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-primary mb-2">
                {label} {isRequired && <span className="text-error-primary">*</span>}
            </label>
            
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isLoading}
                    className={cx(
                        "w-full flex items-center justify-between px-3 py-2 text-left",
                        "border border-secondary rounded-lg bg-primary",
                        "hover:border-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand",
                        "disabled:opacity-60 disabled:cursor-not-allowed"
                    )}
                >
                    <span className={selectedItem ? "text-primary" : "text-tertiary"}>
                        {selectedItem 
                            ? (renderOption ? renderOption(selectedItem) : selectedItem[displayKey]) 
                            : placeholder}
                    </span>
                    {isLoading ? (
                        <Loading02 className="size-4 text-tertiary animate-spin" />
                    ) : (
                        <ChevronDown className="size-4 text-tertiary" />
                    )}
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-primary border border-secondary rounded-lg shadow-lg">
                        <div className="p-2">
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={setSearchQuery}
                                icon={SearchLg}
                                iconClassName="size-4"
                                size="sm"
                            />
                        </div>
                        
                        <div className="max-h-60 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-3 text-center text-tertiary">Loading...</div>
                            ) : options.length === 0 ? (
                                <div className="p-3 text-center text-tertiary">No results found</div>
                            ) : (
                                options.map((item) => (
                                    <button
                                        key={item[valueKey]}
                                        type="button"
                                        onClick={() => handleSelect(item)}
                                        className="w-full px-3 py-2 text-left hover:bg-secondary transition-colors"
                                    >
                                        {renderOption ? renderOption(item) : item[displayKey]}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
