export const actionPopoverPaperStyles = {
  border: 1,
  borderColor: "divider",
  borderRadius: "4px",
  backgroundImage: "none",
} as const;

export const actionMenuListStyles = {
  p: 0.5,
  display: "flex",
  flexDirection: "column",
  gap: 0.25,
  "& .MuiMenuItem-root": { minHeight: 34, borderRadius: "4px" },
  "& .MuiDivider-root": { my: 0.5 },
} as const;
