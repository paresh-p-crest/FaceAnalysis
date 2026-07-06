import React from 'react'

export function AveragenessSection({ averageness }) {
  // Destructure the data passed from cvReport.averageness, using fallbacks if missing
  const score = averageness?.score || 72;
  const category = averageness?.category || averageness?.scoreLabel || "Quite Typical";
  const label = averageness?.scoreLabel || "Above Average";
  const explanation = averageness?.explanation || 
    "Your face is structurally typical overall, with strong alignment to the Average Face in outline, nose, eye spacing, and forehead. Moderate deviations in brows, jaw width, and lip fullness add noticeable distinctiveness while keeping you within a clearly typical, masculine-looking range.";

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto font-sans">
      
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2 tracking-tight">
          An overview of your <span className="text-slate-400 font-normal">averageness</span>
        </h1>
        <p className="text-slate-500 text-sm">
          Facial averageness describes how closely your features match the typical features of people in your demographic group.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* LEFT COLUMN: Shape Analysis */}
        <div className="lg:col-span-2 flex flex-col bg-white border border-gray-100 rounded-xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
          {/* Header & Legend */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Shape Analysis</span>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-slate-300 rounded-sm"></div> YOU
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-slate-500 rounded-sm"></div> AVERAGE
              </div>
            </div>
          </div>

          {/* Graph Area / Face Mesh */}
          <div className="relative flex-1 w-full min-h-[450px] bg-white rounded-lg overflow-hidden border border-gray-50">
            {/* Very fine CSS Grid Background */}
            <div className="absolute inset-0" style={{
                backgroundImage: `linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`,
                backgroundSize: '24px 24px'
            }}></div>
            
            {/* Geometric MediaPipe-style Placeholder SVG */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-90">
                {/* 
                  The viewBox is zoomed in (35 90 230 240) to force the 
                  face to stretch and fill the grid bounds properly. 
                */}
                <svg viewBox="35 90 230 240" className="w-full h-full max-w-[400px]">
                   
                   {/* ======================================= */}
                   {/* AVERAGE MESH (Light Blue - Offset)        */}
                   {/* ======================================= */}
                   <g stroke="#cbd5e1" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round" className="opacity-75">
                     {/* Open Jawline */}
                     <polyline points="65,160 75,205 95,255 125,285 150,300 175,285 205,255 225,205 235,160" />
                     
                     {/* Left Brow */}
                     <polygon points="110,125 85,118 65,128 60,140 85,130 110,132" />
                     {/* Right Brow */}
                     <polygon points="190,125 215,118 235,128 240,140 215,130 190,132" />
                     
                     {/* Left Eye */}
                     <polygon points="120,160 105,152 85,155 75,163 90,168 110,165" />
                     {/* Right Eye */}
                     <polygon points="180,160 195,152 215,155 225,163 210,168 190,165" />

                     {/* Nose Bridge & Base Triangle */}
                     <line x1="150" y1="165" x2="150" y2="235" />
                     <polygon points="150,235 135,248 165,248" />

                     {/* Mouth: Upper & Lower Lips */}
                     <polygon points="125,265 140,258 150,261 160,258 175,265 150,268" />
                     <polygon points="125,265 150,268 175,265 150,278" />
                   </g>

                   {/* ======================================= */}
                   {/* YOU MESH (Dark Slate - Primary)           */}
                   {/* ======================================= */}
                   <g stroke="#64748b" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round">
                     {/* Open Jawline */}
                     <polyline points="55,155 65,210 90,270 125,300 150,315 175,300 210,270 235,210 245,155" />
                     
                     {/* Left Brow */}
                     <polygon points="115,120 85,110 55,122 50,135 85,125 115,127" />
                     {/* Right Brow */}
                     <polygon points="185,120 215,110 245,122 250,135 215,125 185,127" />
                     
                     {/* Left Eye */}
                     <polygon points="125,158 105,148 80,152 70,160 85,166 110,163" />
                     {/* Right Eye */}
                     <polygon points="175,158 195,148 220,152 230,160 215,166 190,163" />

                     {/* Nose Bridge & Base Triangle */}
                     <line x1="150" y1="160" x2="150" y2="230" />
                     <polygon points="150,230 130,245 170,245" />

                     {/* Mouth: Upper & Lower Lips */}
                     <polygon points="115,265 135,255 150,258 165,255 185,265 150,268" />
                     <polygon points="115,265 150,268 185,265 150,285" />
                   </g>
                </svg>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Cards */}
        <div className="flex flex-col gap-5">
          
          {/* Card 1: Main Score */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 flex flex-col shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
             <h3 className="text-center text-[13px] font-medium text-slate-800 mb-6">Averageness</h3>
             
             {/* Large Centered Number */}
             <div className="flex-1 flex justify-center items-center mb-8">
               <span className="text-[88px] leading-none font-light text-slate-800 tracking-tighter">{score}</span>
             </div>
             
             {/* Bottom Separated Row */}
             <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                <span className="text-sm font-medium text-slate-800">{label}</span>
                <span className="text-sm text-slate-400">/100</span>
             </div>
          </div>

          {/* Card 2: Range Slider */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <h3 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Averageness Range</h3>
            <div className="text-lg font-medium text-slate-900 mb-6">{category}</div>
            
            {/* Custom Range Track */}
            <div className="relative w-full h-[3px] bg-slate-200 rounded-full mb-3">
              {/* Dynamic Dot Placement based on score */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-slate-800 rounded-full"
                style={{ left: `${Math.min(100, Math.max(0, score))}%`, transform: 'translate(-50%, -50%)' }}
              ></div>
            </div>
            
            <div className="flex justify-between text-[11px] font-medium text-slate-400">
              <span>Unique</span>
              <span>Typical</span>
            </div>
          </div>

          {/* Card 3: Explanation */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 flex-1 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
            <h3 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3">Explanation</h3>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {explanation}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}