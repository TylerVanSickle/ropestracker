// app/lib/ropesTags.js

export const COURSE_TAGS = [
  { id: "red-toucans", label: "Red Toucans", color: "255, 59, 48" },
  { id: "orange-apes", label: "Orange Apes", color: "255, 149, 0" },
  { id: "yellow-cobras", label: "Yellow Cobras", color: "255, 204, 0" },
  { id: "green-tree-frogs", label: "Green Tree Frogs", color: "52, 199, 89" },
  { id: "blue-sloths", label: "Blue Sloths", color: "0, 122, 255" },
  { id: "purple-parrots", label: "Purple Parrots", color: "175, 82, 222" },
  { id: "pink-panthers", label: "Pink Panthers", color: "255, 45, 85" },
  { id: "brown-koalas", label: "Brown Koalas", color: "162, 132, 94" },
  { id: "black-jaguar", label: "Black Jaguar", color: "40, 40, 40" },
  { id: "maroon-orangutan", label: "Maroon Orangutan", color: "128, 0, 32" },
];

// Optional: keep a string list for places that want just labels
export const COURSE_TAG_LABELS = COURSE_TAGS.map((t) => t.label);
