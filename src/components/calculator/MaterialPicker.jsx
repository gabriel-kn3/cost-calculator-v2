import React, { useMemo, useState, useCallback } from "react";
import { Select, Box, Text } from "grommet";

function escapeRegExp(s = "") {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }) {
  const t = String(text ?? "");
  const q = String(query ?? "").trim();
  if (!q) return <>{t}</>;

  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = t.split(re);

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = part.toLowerCase() === q.toLowerCase();
        return isMatch ? (
          <Text key={i} as="span" weight={700} color={"accent"}>
            {part}
          </Text>
        ) : (
          <Text key={i} as="span">
            {part}
          </Text>
        );
      })}
    </>
  );
}

export default function MaterialPicker({
  materials,
  valueId,
  onSelect,
  placeholder = "Select material",
}) {
  const [query, setQuery] = useState("");

  const options = useMemo(() => materials || [], [materials]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((m) =>
      String(m?.name ?? "")
        .toLowerCase()
        .includes(q)
    );
  }, [options, query]);

  const selected = useMemo(
    () => options.find((m) => m.id === valueId) || null,
    [options, valueId]
  );

  const onSearch = useCallback((text) => setQuery(text), []);

  return (
    <Select
      options={filtered}
      labelKey="name"
      valueKey={{ key: "id", reduce: true }}
      value={valueId || ""}
      placeholder={placeholder}
      searchable
      onSearch={onSearch}
      onClose={() => setQuery("")} // optional: reset search when closing
      onChange={({ option }) => onSelect?.(option)}
      // If your Grommet supports this prop, it will show automatically when filtered is empty
      emptySearchMessage={<Text size="small">No results</Text>}
      valueLabel={
        selected ? (
          <Text size="small" weight={600}>
            {selected.name}
          </Text>
        ) : (
          <Text size="small" color="text-muted">
            {placeholder}
          </Text>
        )
      }
      // Fallback for older Grommet versions: show "No results" when filtered is empty
      dropContent={
        filtered.length === 0 ? (
          <Box pad="small">
            <Text size="small" color="text-muted">
              No results
            </Text>
          </Box>
        ) : undefined
      }
    >
      {(option) => (
        <Box pad="xsmall" direction="row" gap="xsmall" align="center">
          <Text size="small">
            <Highlight text={option.name} query={query} />
          </Text>

          {String(option.name || "").includes("*") && (
            <Text size="xsmall" color="text-muted">
              (common)
            </Text>
          )}
        </Box>
      )}
    </Select>
  );
}
