import { useState, useEffect, useCallback, useRef } from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface Item {
  id: string;
  name: string;
}

interface CreatableSelectProps {
  value: string | null;
  onChange: (id: string) => void;
  fetchItems: (keyword: string) => Promise<Item[]>;
  createItem: (name: string) => Promise<Item>;
  placeholder?: string;
}

export function CreatableSelect({ value, onChange, fetchItems, createItem, placeholder = "选择..." }: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectedItem = items.find((i) => i.id === value);

  const search = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const results = await fetchItems(keyword);
      setItems(results);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [fetchItems]);

  useEffect(() => { search(""); }, [search]);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleCreate = async () => {
    if (!inputValue.trim()) return;
    try {
      const newItem = await createItem(inputValue.trim());
      onChange(newItem.id);
      setOpen(false);
      setInputValue("");
    } catch {
      // 409 conflict: try to find the existing item
      try {
        const results = await fetchItems(inputValue.trim());
        const match = results.find((r) => r.name === inputValue.trim());
        if (match) onChange(match.id);
      } catch (error) {
        console.error('Failed to recover an existing select item', error);
      }
      setOpen(false);
    }
  };

  const exactMatch = items.some((i) => i.name === inputValue.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {selectedItem ? selectedItem.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="搜索..." value={inputValue} onValueChange={handleInputChange} />
          <CommandList>
            {loading && <CommandEmpty>搜索中...</CommandEmpty>}
            {!loading && items.length === 0 && inputValue.trim() && (
              <CommandEmpty>无结果</CommandEmpty>
            )}
            <CommandGroup>
              {inputValue.trim() && !exactMatch && (
                <CommandItem onSelect={handleCreate} className="text-red-600 font-medium">
                  使用当前输入：{inputValue.trim()}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => { onChange(item.id); setOpen(false); setInputValue(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type { Item as CreatableSelectItem };
