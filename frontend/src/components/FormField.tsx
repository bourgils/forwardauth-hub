import { Box, FormLabel, TextField, type FormLabelProps, type TextFieldProps } from "@mui/material";
import { useId } from "react";

export function FieldLabel(props: FormLabelProps) {
  return <FormLabel {...props} sx={{ display: "block", mb: 0.75, color: "text.secondary", fontSize: 12, fontWeight: 600, lineHeight: 1.4, "& .MuiFormLabel-asterisk": { color: "error.main" } }} />;
}

type LabeledTextFieldProps = Omit<TextFieldProps, "label"> & { label: string };

export function LabeledTextField({ id, label, placeholder, required, fullWidth = true, ...props }: LabeledTextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Box sx={{ width: fullWidth ? "100%" : undefined }}>
      <FieldLabel htmlFor={inputId} required={required}>{label}</FieldLabel>
      <TextField {...props} id={inputId} placeholder={placeholder ?? label} required={required} fullWidth={fullWidth} />
    </Box>
  );
}
