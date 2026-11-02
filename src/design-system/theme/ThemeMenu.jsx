import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.jsx";
import { Button } from "../primitives/Button.jsx";
import { ThemeSettings } from "./ThemeSettings.jsx";

export function ThemeMenu() {
  return <Popover>
    <PopoverTrigger asChild><Button variant="secondary" size="icon" aria-label="Alterar aparência" title="Alterar aparência"><Palette data-icon="inline-start" aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent align="end" className="theme-menu"><ThemeSettings /></PopoverContent>
  </Popover>;
}
