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
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const nameMapRef = useRef<Map<string, string>>(new Map());
  // 手动新建项持久存储——不从 items prev 中提取，避免被 search 过滤后丢失
  const manualItemsRef = useRef<Item[]>([]);
  // 保存最新 value，供 search 完成后同步 selectedName（在 effect 中同步，避免 render 期写 ref）
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const syncNameMap = (list: Item[]) => {
    for (const item of list) {
      if (item.id && item.name) nameMapRef.current.set(item.id, item.name);
    }
  };

  // 当外部 value 变化时，尝试从 nameMap 恢复显示名
  useEffect(() => {
    if (value && nameMapRef.current.has(value)) {
      setSelectedName(nameMapRef.current.get(value)!);
    } else if (!value) {
      setSelectedName(null);
    }
  }, [value]);

  const search = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const results = await fetchItems(keyword);
      const kw = keyword.trim().toLowerCase();
      const matchingManual = kw
        ? manualItemsRef.current.filter((m) => m.name.toLowerCase().includes(kw))
        : manualItemsRef.current;
      const filtered = results.filter((r) => !matchingManual.some((m) => m.name === r.name));
      const merged = [...matchingManual, ...filtered];
      syncNameMap(merged);
      setItems(merged);
      // search 完成后同步 selectedName（解决编辑回显时 nameMap 尚未就绪的问题）
      if (valueRef.current && nameMapRef.current.has(valueRef.current)) {
        setSelectedName(nameMapRef.current.get(valueRef.current)!);
      }
    } catch {
      const kw = keyword.trim().toLowerCase();
      const matchingManual = kw
        ? manualItemsRef.current.filter((m) => m.name.toLowerCase().includes(kw))
        : manualItemsRef.current;
      syncNameMap(matchingManual);
      setItems(matchingManual);
      if (valueRef.current && nameMapRef.current.has(valueRef.current)) {
        setSelectedName(nameMapRef.current.get(valueRef.current)!);
      }
    }
    finally { setLoading(false); }
  }, [fetchItems]);

  useEffect(() => { search(""); }, [search]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      search("");
      setTimeout(() => {
        if (value && listRef.current) {
          const el = listRef.current.querySelector(`[data-item-id="${value}"]`);
          if (el) el.scrollIntoView({ block: 'nearest' });
        }
      }, 100);
    }
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (item: Item) => {
    setSelectedName(item.name);
    nameMapRef.current.set(item.id, item.name);
    onChange(item.id);
    setOpen(false);
    setInputValue("");
  };

  const handleCreate = async () => {
    if (!inputValue.trim()) return;
    try {
      await createItem(inputValue.trim());
      const localId = `__${nextIdRef.current++}`;
      const newItem = { id: localId, name: inputValue.trim() };
      manualItemsRef.current = [...manualItemsRef.current, newItem];
      setItems((prev) => [newItem, ...prev]);
      syncNameMap([newItem]);
      handleSelect(newItem);
    } catch {
      try {
        const results = await fetchItems(inputValue.trim());
        const match = results.find((r) => r.name === inputValue.trim());
        if (match) { handleSelect(match); return; }
      } catch (error) {
        console.error('Failed to recover an existing select item', error);
      }
      setOpen(false);
    }
  };

  const exactMatch = items.some((i) => i.name === inputValue.trim());

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("w-full justify-between", !selectedName && "text-[#94A3B8]")}>
          {selectedName || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="搜索..." value={inputValue} onValueChange={handleInputChange} />
          <CommandList ref={listRef}>
            {loading && <CommandEmpty>搜索中...</CommandEmpty>}
            {!loading && items.length === 0 && inputValue.trim() && (
              <CommandEmpty>无结果</CommandEmpty>
            )}
            <CommandGroup>
              {inputValue.trim() && !exactMatch && (
                <CommandItem onSelect={handleCreate} className="text-blue-600 font-medium">
                  {inputValue.trim()}
                </CommandItem>
              )}
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  data-item-id={item.id}
                  onSelect={() => handleSelect(item)}
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
