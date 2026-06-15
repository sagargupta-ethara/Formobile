// The firm's drawing register: every drawing type, scoped to the floor zones
// it applies to. A drawing appearing in several zone lists becomes ONE
// category with multiple `appliesTo` entries.

export type FloorTypeName = "BASEMENT" | "STILT" | "FLOOR" | "TERRACE";

export const FLOOR_TYPE_LABEL: Record<FloorTypeName, string> = {
  BASEMENT: "Basement",
  STILT: "Stilt",
  FLOOR: "Floor",
  TERRACE: "Terrace",
};

/** Drawing types for the ground floor and all upper floors. */
const FLOOR_DRAWINGS = [
  "Ground Floor Slab Shuttering Plan",
  "Ground Floor Slab Beam and Steel Framing Plan",
  "Ground Floor Slab — FF Bathroom & Kitchen Plumbing Pipeline Layout Plan",
  "Ground Floor Slab Electrical Conduiting Plan",
  "Ground Floor Slab Beam Sleeve Location",
  "Plumbing Centre Line",
  "DB Location",
  "Brickwork + Door Schedule",
  "Internal Staircase",
  "Geyser Location + Exhaust Location",
  "Wall Electrical + Remote Location",
  "AC Drain Pipe",
  "RCP (Advance Copy with Levels)",
  "RCP Sections",
  "RCP with Cornice + Lighting Details",
  "Automation",
  "Kitchen EPT",
  "Bathroom Plumbing",
  "Flooring Plan",
  "Internal Staircase Details",
  "Flooring Plan with Inlay + Skirting Detail",
  "Portal Detailed Drawing",
  "Lift Façade Elevation",
  "Bathroom Elevations with Material (incl. Marble Basin + Vanity)",
  "Internal Wall Elevations (Living Room, Double Height, Mouldings, Fireplace, Bar)",
  "Veneer Ceiling Drawings",
  "Wall Finishes",
  "Wardrobe / Joinery Drawings",
];

/** Drawing types for basement levels. */
const BASEMENT_DRAWINGS = [
  "Foundation Structure Drawing",
  "Building Sanction Plan",
  "Excavation Plan",
  "Grid Column Layout",
  "Foundation Set",
  "Column Steel Schedule",
  "Underground Water Tank & Harvesting Structure",
  "Building Slab Height Section",
  "Main Staircase Structure with Section Details",
  "Basement Staircase Structure with Section Detail",
  "Septic Tank Location",
  "Stilt Floor Bathroom Plumbing Pipeline Plan",
  "Shuttering Plan",
  "Basement Slab Beam & Steel Framing Plan",
  "Basement Slab Electrical Conduiting Plan",
  "Basement Slab Beam AC Sleeve Location",
  "Plumbing Centre Line",
  "Plumbing Centre Line — Revision 1",
  "Sump Location",
  "DB Location",
  "Brickwork + Door Schedule",
  "Internal Staircase",
  "Geyser Location + Exhaust Location",
  "Wall Electrical + Remote Location",
  "AC Drain Pipe",
  "RCP (Advance Copy with Levels)",
  "RCP Sections",
  "RCP with Cornice + Lighting Details",
  "Automation",
  "Kitchen / Pantry EPT",
  "Bathroom Plumbing",
  "Flooring Plan",
  "Internal Staircase Details",
  "Flooring Plan with Inlay + Skirting Detail",
  "Portal Detailed Drawing",
  "Lift Façade Elevation",
  "Bathroom Elevations with Material (incl. Marble Basin + Vanity)",
  "Internal Wall Elevations (Living Room, Double Height, Mouldings, Fireplace, Bar)",
  "Veneer Ceiling Drawings",
  "Wall Finishes",
  "Wardrobe / Joinery Drawings",
];

/** Drawing types for the stilt floor. */
const STILT_DRAWINGS = [
  "Stilt Services — AC Outdoor, Water Meter, Electrical LT Panel, Genset Location",
  "Stilt Floor Driveway Area Sewerage Line Layout Plan",
  "Stilt Floor Slab Shuttering Plan",
  "Stilt Floor Slab Beam and Steel Framing Plan",
  "Stilt Floor Slab — GF Bathroom Plumbing Pipeline Layout Plan",
  "Stilt Floor Slab Electrical Conduiting Plan",
  "Stilt Floor Slab Beam Sleeve Location",
  "Stilt Floor Brickwork Layout Plan",
  "Lift Decision and Drawing",
  "Camera Location",
  "Driveway Flooring Plan",
  "Plumbing Centre Line",
  "Sump Location / Water Tank",
  "AC Outdoor Unit, Water Meter, Electrical LT Panel & Genset Location",
  "Brickwork + Door Schedule",
  "Wall Electrical + Remote Location",
  "AC Drain Pipe",
  "RCP (Advance Copy with Levels)",
  "RCP Sections",
  "RCP with Cornice + Lighting Details",
  "Flooring Plan — Stilt Lobby",
  "Flooring Plan with Inlay + Skirting Detail",
  "Portal Detailed Drawing",
  "Lift Façade Elevation",
];

/** Drawing types for the terrace. */
const TERRACE_DRAWINGS = [
  "Terrace Mumty Structure Drawing",
  "Terrace Layout Plan (Bar, Pergola, Stone Flooring Details)",
  "Landscape Plan — Terrace and Stilt Floor",
  "External Door Window Detail Drawing",
  "Balcony Railing Detail (MS/Glass)",
  "Balcony Flooring Detail",
  "Plumbing Centre Line",
  "Brickwork + Door Schedule",
  "Wall Electrical",
  "Pantry EPT",
  "Bathroom Plumbing",
  "Flooring Plan",
  "Flooring Plan with Inlay + Skirting Detail",
  "Portal Detailed Drawing",
  "Lift Façade Elevation",
  "Bathroom Elevations with Material (incl. Marble Basin + Vanity)",
  "Wall Finishes",
  "Bar, Firepit, Water Body, Pergola, Powder Toilet, Pantry",
];

/** Merged register: one entry per unique drawing name, with all zones it appears in. */
export function drawingRegister(): { name: string; appliesTo: FloorTypeName[] }[] {
  const map = new Map<string, Set<FloorTypeName>>();
  const add = (names: string[], type: FloorTypeName) => {
    for (const n of names) {
      if (!map.has(n)) map.set(n, new Set());
      map.get(n)!.add(type);
    }
  };
  add(FLOOR_DRAWINGS, "FLOOR");
  add(BASEMENT_DRAWINGS, "BASEMENT");
  add(STILT_DRAWINGS, "STILT");
  add(TERRACE_DRAWINGS, "TERRACE");
  return [...map.entries()].map(([name, types]) => ({
    name,
    appliesTo: [...types],
  }));
}

export type DisciplineName = "INTERIOR" | "STRUCTURE" | "MEP" | "WOODWORK";

export const DISCIPLINE_LABEL: Record<DisciplineName, string> = {
  INTERIOR: "Interior Design",
  STRUCTURE: "Structure",
  MEP: "MEP",
  WOODWORK: "Woodwork",
};

/**
 * Which design department produces a drawing (the floor head-tabs).
 * Per the firm's convention: Plumbing Centre Line / RCP / portals are
 * Interior; columns, excavation, shuttering are Structure; conduiting,
 * DB, pipelines are MEP; veneer/joinery are Woodwork. Admin can refine
 * per project in Settings.
 */
export function guessDiscipline(name: string): DisciplineName {
  const n = name.toLowerCase();
  if (/veneer|wardrobe|joinery|woodwork/.test(n)) return "WOODWORK";
  if (
    /shuttering|steel|foundation|excavation|grid column|column steel|sanction|slab height|staircase structure|mumty|harvesting|brickwork/.test(n)
  )
    return "STRUCTURE";
  if (
    /conduiting|db location|wall electrical|automation|camera|ept|geyser|exhaust|ac drain|sleeve|ac outdoor|lt panel|genset|water meter|sewerage|pipeline|sump|septic|water tank|bathroom plumbing|services/.test(n)
  )
    return "MEP";
  return "INTERIOR";
}

/**
 * Best-guess specialization for routing a drawing to the right on-site team.
 * Admin can refine these later in Settings.
 */
export function guessSpecialization(name: string): string | null {
  const n = name.toLowerCase();
  if (/plumbing|sewerage|sump|septic|water tank|geyser|water body/.test(n))
    return "Plumbing";
  if (/ac |ac drain|sleeve|hvac|exhaust/.test(n)) return "HVAC";
  if (/electrical|db location|conduiting|automation|camera|ept|lt panel|genset|lighting/.test(n))
    return "Electrical";
  if (/landscape|pergola|firepit/.test(n)) return "Landscape";
  if (
    /flooring|rcp|wall finishes|veneer|wardrobe|joinery|elevations|cornice|inlay|skirting|vanity|mouldings/.test(n)
  )
    return "Interior";
  if (
    /shuttering|steel|foundation|excavation|column|staircase|brickwork|sanction|slab|structure|mumty|railing|portal|façade|facade|door window/.test(n)
  )
    return "Civil";
  return null;
}
