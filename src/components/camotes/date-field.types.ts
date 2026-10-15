export interface DateFieldProps {
  label: string;
  /** Calendar date in YYYY-MM-DD format, or an empty string. */
  value: string;
  onChangeText: (value: string) => void;
  minimumDate?: string;
  maximumDate?: string;
  /** Preferred opening date for a field without a valid value. */
  initialDate?: string;
  optional?: boolean;
  helperText?: string;
  disabled?: boolean;
}
