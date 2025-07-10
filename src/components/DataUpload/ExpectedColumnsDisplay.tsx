import React, { useState } from "react";

interface Section {
  title: string;
  children: (string | Section)[];
}

const structure: Section = {
  title: "Process information",
  children: [
    "Status",
    "OEM",
    "Carline",
    "Constructed space",
    "Realization planned",
    "Approx. realization date",
    "Start date",
    "End date",
    "Process number",
    "OEM-Offer-/ Change number",
    "Reason for changes",
    {
      title: "Phase4",
      children: [
        "Start date",
        "End date",
        {
          title: "PAV",
          children: [
            "Start date",
            "End date",
            "Estimated costs",
            "Tools / utilities available",
            "Process - FMEA",
            "PLP Relevant",
            "Risk level actual",
          ],
        },
      ],
    },
    {
      title: "Phase8",
      children: [
        "Start date",
        "End date",
        {
          title: "Change packages",
          children: ["Name"],
        },
      ],
    },
  ],
};

const CollapsibleSection: React.FC<{ section: Section; level?: number }> = ({ section, level = 0 }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className={`pl-${level * 4} mb-2`}>
      <div
        className="cursor-pointer font-semibold text-[#00f0cc] hover:underline"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "▼" : "▶"} {section.title}
      </div>
      {open && (
        <div className="mt-2">
          {section.children.map((child, idx) => {
            if (typeof child === "string") {
              return (
                <div key={idx} className="ml-4 bg-white text-black rounded px-3 py-1 mb-1 shadow">
                  {child}
                </div>
              );
            }
            return <CollapsibleSection key={idx} section={child} level={level + 1} />;
          })}
        </div>
      )}
    </div>
  );
};

const ExpectedColumnsDisplay: React.FC = () => {
  return (
    <div className="bg-white/10 border border-white/20 backdrop-blur-md p-6 rounded-xl shadow-xl mb-6 text-white">
      <h3 className="text-xl font-bold mb-4 text-[#00f0cc]">Required Columns in Excel File</h3>
      <p className="text-sm mb-4 text-white/80">
        Please make sure your Excel file includes the following column headers exactly as shown below:
      </p>
      <CollapsibleSection section={structure} />
    </div>
  );
};

export default ExpectedColumnsDisplay;
