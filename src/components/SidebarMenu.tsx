import React from "react";
import { Link, useLocation } from "react-router-dom";

import drxIcon from "../assets/images/drx.png";
import downtimeIcon from "../assets/images/downtime.png";
import budgetIcon from "../assets/images/budget.png";
import followupIcon from "../assets/images/costs.png";
import scrapIcon from "../assets/images/scrap.png";
import targetIcon from "../assets/images/target.png";

const tabs = [
  { path: "/kpis/followup", label: " Cost PA ",        icon: followupIcon },
  { path: "/kpis/scrap",      label: "Scrap",                 icon: scrapIcon    },
  { path: "/kpis/drx",        label: "Engineering DRX Ideas", icon: drxIcon      },
  { path: "/kpis/downtime",   label: "Downtime",              icon: downtimeIcon },
  { path: "/kpis/budget",     label: "Budget",                icon: budgetIcon   },
  { path: "/kpis/phase4",     label: "Phase 4 Closure",       icon: targetIcon   },
];

const SidebarMenu: React.FC = () => {
  const location = useLocation();

  return (
    <aside
      className="w-64 flex flex-col justify-center items-center h-full border-r border-white/20"
      style={{
        backgroundImage: `url(/src/assets/images/harness-bg.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <nav className="flex flex-col items-center justify-center gap-8 w-full">
        {tabs.map(({ path, label, icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              to={path}
              key={path}
              className={`
                flex flex-row items-center justify-start gap-4
                w-64 h-20 rounded-xl font-semibold text-lg transition
                bg-yellow-400 text-black hover:bg-yellow-500
                ${isActive ? "shadow-lg" : ""}
              `}
            >
              <img
                src={icon}
                alt={label}
                className="w-12 h-12 object-contain"
              />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default SidebarMenu;
