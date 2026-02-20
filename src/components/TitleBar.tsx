import { CREAM, SAGE } from "../lib/theme";

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      style={{
        height: 40,
        flexShrink: 0,
        background: CREAM[50],
        borderBottom: `1px solid ${SAGE[100]}`,
      }}
    />
  );
}
