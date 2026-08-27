import { Box, ButtonBase, Dialog, DialogContent, Divider, List, ListItemButton, ListItemText, OutlinedInput, SvgIcon, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { adminDestinations } from "../layouts/adminNavigation";

function SearchIcon() {
  return <SvgIcon fontSize="small"><path d="M9.5 3a6.5 6.5 0 1 0 4.03 11.6L18.93 20 20 18.93l-5.4-5.4A6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" /></SvgIcon>;
}

export function AdminCommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return adminDestinations;
    return adminDestinations.filter((destination) => `${destination.label} ${destination.description} ${destination.keywords} ${destination.section}`.toLowerCase().includes(normalizedQuery));
  }, [query]);

  useEffect(() => {
    const openWithShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", openWithShortcut);
    return () => window.removeEventListener("keydown", openWithShortcut);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function goTo(path: string) {
    close();
    navigate(path);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!results.length) return;
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      goTo(results[activeIndex].to);
    } else if (event.key === "Escape") {
      close();
    }
  }

  return (
    <>
      <ButtonBase
        aria-label="Open application search"
        onClick={() => setOpen(true)}
        sx={{ width: "100%", px: 1.25, py: 0.875, justifyContent: "flex-start", gap: 1, border: 1, borderColor: "divider", borderRadius: "4px", color: "text.secondary", bgcolor: "background.paper" }}
      >
        <SearchIcon />
        <Typography component="span" sx={{ flex: 1, textAlign: "left", fontSize: 13 }}>Search</Typography>
        <Box component="kbd" sx={{ px: 0.75, py: 0.375, border: 1, borderColor: "divider", borderRadius: "3px", color: "text.disabled", fontFamily: "inherit", fontSize: 11, lineHeight: 1 }}>⌘ K</Box>
      </ButtonBase>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm" slotProps={{ paper: { "aria-label": "Search application sections", sx: { borderRadius: "4px" } }, transition: { onEntered: () => searchInputRef.current?.focus() } }}>
        <Box sx={{ p: 1.5 }}>
          <OutlinedInput
            autoFocus
            inputRef={searchInputRef}
            fullWidth
            value={query}
            placeholder="Search users, groups, applications…"
            slotProps={{ input: { "aria-label": "Search application sections" } }}
            startAdornment={<Box sx={{ mr: 1, color: "text.secondary", display: "flex" }}><SearchIcon /></Box>}
            endAdornment={<Box component="kbd" sx={{ color: "text.disabled", fontFamily: "inherit", fontSize: 11 }}>ESC</Box>}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
          />
        </Box>
        <Divider />
        <DialogContent sx={{ minHeight: 260, p: 1 }}>
          <Typography sx={{ px: 1, py: 0.75, color: "text.disabled", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{query.trim() ? "Results" : "Quick access"}</Typography>
          {results.length ? <List disablePadding>
            {results.map((destination, index) => <ListItemButton key={destination.to} selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => goTo(destination.to)} sx={{ borderRadius: "4px", px: 1.25, py: 0.75 }}>
              <ListItemText primary={destination.label} secondary={destination.description} slotProps={{ primary: { sx: { fontWeight: 650 } }, secondary: { sx: { fontSize: 12 } } }} />
              <Typography color="text.disabled" sx={{ ml: 2, fontSize: 11 }}>{destination.section}</Typography>
            </ListItemButton>)}
          </List> : <Typography color="text.secondary" sx={{ px: 1, py: 2 }}>No matching section.</Typography>}
        </DialogContent>
      </Dialog>
    </>
  );
}
