import React, { useCallback, useMemo, useRef, useState } from 'react';
import { CATEGORY_META, DialConfig, TimeBlock } from '../types/schedule';
import {
  describeAnnularArc,
  formatDuration,
  formatMinutes,
  getDurationMinutes,
  getRemainingMinutesInBlock,
  isMinuteInBlock,
  MINUTES_IN_DAY,
  minutesToSvgAngle,
  pointToMinutes,
  polarToCartesian,
} from '../utils/timeMath';
import {
  formatNineDayDateLine,
  getNineDayInfo,
  NineDayInfo,
} from '../utils/nineDayCalendar';

interface CircleTimeDialProps {
  blocks: TimeBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlockTime: (id: string, startMinutes: number, endMinutes: number) => void;
  onCreateBlockFromArc: (startMinutes: number, endMinutes: number) => void;
  dialConfig: DialConfig;
  /** Current minute of day (0..1439) used for the time hand */
  currentMinutes: number;
  /** Current seconds (0..59) */
  currentSeconds: number;
  currentDate?: Date;
  nineDayInfo?: NineDayInfo;
  isLiveMode: boolean;
  onScrubMinutes?: (minutes: number) => void;
  compact?: boolean;
  svgRefExternal?: React.RefObject<SVGSVGElement | null>;
}

type DragState =
  | { kind: 'resize-start'; blockId: string; fixedEnd: number }
  | { kind: 'resize-end'; blockId: string; fixedStart: number }
  | { kind: 'draw-new'; anchorMinute: number; currentMinute: number }
  | { kind: 'scrub-hand' }
  | null;

const CX = 300;
const CY = 300;
const R_OUTER_BEZEL = 284;
const R_NUMERAL = 256;
const R_TICK_OUTER = 236;
const R_ARC_OUTER = 222;
const R_ARC_INNER = 166;
const R_ARC_MID = (R_ARC_OUTER + R_ARC_INNER) / 2;
const R_HUB = 152;

export const CircleTimeDial: React.FC<CircleTimeDialProps> = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlockTime,
  onCreateBlockFromArc,
  dialConfig,
  currentMinutes,
  currentSeconds,
  currentDate,
  nineDayInfo,
  isLiveMode,
  onScrubMinutes,
  compact = false,
  svgRefExternal,
}) => {
  const internalRef = useRef<SVGSVGElement | null>(null);
  const svgRef = svgRefExternal ?? internalRef;

  const [dragState, setDragState] = useState<DragState>(null);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);

  const isDark = dialConfig.dialTheme === 'obsidian';

  const palette = useMemo(
    () =>
      isDark
        ? {
            faceBg: '#12151A',
            outerTrack: '#191D24',
            hubBg: '#0C0E12',
            ringStroke: '#282E38',
            subtleStroke: '#1F242D',
            tickMajor: '#CBD5E1',
            tickMinor: '#475569',
            numeralMain: '#F8FAFC',
            numeralMuted: '#94A3B8',
            hubPrimary: '#F8FAFC',
            hubSecondary: '#94A3B8',
            handColor: '#EF4444',
          }
        : {
            faceBg: '#FFFFFF',
            outerTrack: '#F3F4F1',
            hubBg: '#FAFAF8',
            ringStroke: '#E2E4DF',
            subtleStroke: '#ECEEE9',
            tickMajor: '#1E293B',
            tickMinor: '#CBD5E1',
            numeralMain: '#111315',
            numeralMuted: '#64748B',
            hubPrimary: '#111315',
            hubSecondary: '#64748B',
            handColor: '#D9381E',
          },
    [isDark]
  );

  const getSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: CX, y: CY };
    const rect = svg.getBoundingClientRect();
    const scaleX = 600 / rect.width;
    const scaleY = 600 / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [svgRef]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragState) return;
      const { x, y } = getSvgCoords(e.clientX, e.clientY);
      const minute = pointToMinutes(
        x,
        y,
        CX,
        CY,
        dialConfig.zeroPosition,
        dialConfig.snapMinutes
      );

      if (dragState.kind === 'resize-start') {
        if (minute !== dragState.fixedEnd) {
          onUpdateBlockTime(dragState.blockId, minute, dragState.fixedEnd);
        }
      } else if (dragState.kind === 'resize-end') {
        const nextEnd = minute === 0 ? MINUTES_IN_DAY : minute;
        if (nextEnd !== dragState.fixedStart) {
          onUpdateBlockTime(dragState.blockId, dragState.fixedStart, nextEnd);
        }
      } else if (dragState.kind === 'draw-new') {
        setDragState({ ...dragState, currentMinute: minute });
      } else if (dragState.kind === 'scrub-hand' && onScrubMinutes) {
        onScrubMinutes(minute);
      }
    },
    [dragState, dialConfig.snapMinutes, dialConfig.zeroPosition, getSvgCoords, onScrubMinutes, onUpdateBlockTime]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragState) return;
      if (dragState.kind === 'draw-new') {
        const dur = getDurationMinutes(dragState.anchorMinute, dragState.currentMinute);
        if (dur >= dialConfig.snapMinutes && dur < MINUTES_IN_DAY - dialConfig.snapMinutes) {
          const endVal =
            dragState.currentMinute === 0 ? MINUTES_IN_DAY : dragState.currentMinute;
          onCreateBlockFromArc(dragState.anchorMinute, endVal);
        }
      }
      if (svgRef.current && svgRef.current.hasPointerCapture(e.pointerId)) {
        svgRef.current.releasePointerCapture(e.pointerId);
      }
      setDragState(null);
    },
    [dragState, dialConfig.snapMinutes, onCreateBlockFromArc, svgRef]
  );

  const handleRingPointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (compact) return;
    const { x, y } = getSvgCoords(e.clientX, e.clientY);
    const dist = Math.hypot(x - CX, y - CY);

    if (dist <= R_HUB && !isLiveMode && onScrubMinutes) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const m = pointToMinutes(
        x,
        y,
        CX,
        CY,
        dialConfig.zeroPosition,
        dialConfig.snapMinutes
      );
      onScrubMinutes(m);
      setDragState({ kind: 'scrub-hand' });
      return;
    }

    if (dist >= R_ARC_INNER && dist <= R_ARC_OUTER) {
      svgRef.current?.setPointerCapture(e.pointerId);
      const m = pointToMinutes(
        x,
        y,
        CX,
        CY,
        dialConfig.zeroPosition,
        dialConfig.snapMinutes
      );
      onSelectBlock(null);
      setDragState({ kind: 'draw-new', anchorMinute: m, currentMinute: m });
    }
  };

  // Active block under the live/preview hand
  const activeBlocksNow = useMemo(
    () => blocks.filter((b) => isMinuteInBlock(currentMinutes, b)),
    [blocks, currentMinutes]
  );
  const primaryActiveBlock = activeBlocksNow[0] ?? null;

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );

  // Hand angle
  const exactMinutes = currentMinutes + (isLiveMode ? currentSeconds / 60 : 0);
  const handAngle = minutesToSvgAngle(exactMinutes, dialConfig.zeroPosition);
  const handTip = polarToCartesian(CX, CY, R_TICK_OUTER - 2, handAngle);
  const handTail = polarToCartesian(CX, CY, 26, handAngle + 180);

  // Seconds subtle tick angle (sweeping 0-60s on the inner hub bezel)
  const secAngle = (currentSeconds / 60) * 360 - 90;
  const secDot = polarToCartesian(CX, CY, R_HUB - 10, secAngle);

  const formattedClock = `${formatMinutes(currentMinutes)}:${String(
    Math.floor(currentSeconds)
  ).padStart(2, '0')}`;

  const resolvedDayInfo = useMemo(
    () => nineDayInfo ?? getNineDayInfo(currentDate ?? new Date()),
    [nineDayInfo, currentDate]
  );
  const dateReadout = formatNineDayDateLine(resolvedDayInfo);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const ticks = useMemo(() => Array.from({ length: 96 }, (_, i) => i), []);

  // Hub display block: show hovered -> selected -> active now
  const inspectedBlock =
    blocks.find((b) => b.id === hoveredBlockId) ??
    selectedBlock ??
    primaryActiveBlock;

  const truncateTitle = (text: string, maxLen: number) =>
    text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;

  return (
    <div className="relative w-full aspect-square select-none">
      <svg
        ref={svgRef}
        viewBox="0 0 600 600"
        className="w-full h-full touch-none"
        role="img"
        aria-label="391K 00 to 24 Hour Circle Time Dial"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Outer Chronometer Face */}
        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER_BEZEL}
          fill={palette.faceBg}
          stroke={palette.ringStroke}
          strokeWidth="1.5"
        />

        {/* Subtle Hour & Quarter-Day Radial Guides */}
        {[0, 360, 720, 1080].map((m) => {
          const ang = minutesToSvgAngle(m, dialConfig.zeroPosition);
          const p1 = polarToCartesian(CX, CY, R_HUB, ang);
          const p2 = polarToCartesian(CX, CY, R_ARC_OUTER + 12, ang);
          return (
            <line
              key={`guide-${m}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={palette.subtleStroke}
              strokeWidth="1"
            />
          );
        })}

        {/* 24-Hour Arc Track Base */}
        <circle
          cx={CX}
          cy={CY}
          r={R_ARC_MID}
          fill="none"
          stroke={palette.outerTrack}
          strokeWidth={R_ARC_OUTER - R_ARC_INNER}
          className={!compact ? 'cursor-crosshair' : ''}
          onPointerDown={handleRingPointerDown}
        />

        {/* Inner & Outer Track Borders */}
        <circle
          cx={CX}
          cy={CY}
          r={R_ARC_OUTER}
          fill="none"
          stroke={palette.ringStroke}
          strokeWidth="1"
          pointerEvents="none"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R_ARC_INNER}
          fill="none"
          stroke={palette.ringStroke}
          strokeWidth="1"
          pointerEvents="none"
        />

        {/* 96 Precision Ticks (every 15 min) */}
        {ticks.map((idx) => {
          const minute = idx * 15;
          const isHour = idx % 4 === 0;
          const isCardinal = idx % 24 === 0;
          const ang = minutesToSvgAngle(minute, dialConfig.zeroPosition);
          const innerR = isCardinal
            ? R_TICK_OUTER - 12
            : isHour
            ? R_TICK_OUTER - 9
            : R_TICK_OUTER - 4;
          const p1 = polarToCartesian(CX, CY, innerR, ang);
          const p2 = polarToCartesian(CX, CY, R_TICK_OUTER, ang);
          return (
            <line
              key={`tick-${idx}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={isHour ? palette.tickMajor : palette.tickMinor}
              strokeWidth={isCardinal ? '2' : isHour ? '1.3' : '0.9'}
              strokeLinecap="round"
              pointerEvents="none"
            />
          );
        })}

        {/* 00 - 23 Hour Numerals */}
        {hours.map((hr) => {
          const ang = minutesToSvgAngle(hr * 60, dialConfig.zeroPosition);
          const pos = polarToCartesian(CX, CY, R_NUMERAL, ang);
          const isCardinal = hr % 6 === 0;
          const isZero = hr === 0;
          return (
            <text
              key={`hr-${hr}`}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={
                isZero
                  ? palette.handColor
                  : isCardinal
                  ? palette.numeralMain
                  : palette.numeralMuted
              }
              fontSize={isCardinal ? '15' : '12.5'}
              fontWeight={isCardinal ? '600' : '500'}
              fontFamily="JetBrains Mono, monospace"
              pointerEvents="none"
            >
              {String(hr).padStart(2, '0')}
            </text>
          );
        })}

        {/* Schedule Time Blocks as Interactive Annular Arcs */}
        {blocks.map((block) => {
          const startAng = minutesToSvgAngle(block.startMinutes, dialConfig.zeroPosition);
          const endAng = minutesToSvgAngle(block.endMinutes, dialConfig.zeroPosition);
          const meta = CATEGORY_META[block.category];
          const isSelected = block.id === selectedBlockId;
          const isHovered = block.id === hoveredBlockId;
          const isActiveNow = isMinuteInBlock(currentMinutes, block);

          const path = describeAnnularArc(
            CX,
            CY,
            R_ARC_INNER + 2,
            R_ARC_OUTER - 2,
            startAng,
            endAng
          );

          // Optional radial midpoint label if arc >= 75 minutes
          const dur = getDurationMinutes(block.startMinutes, block.endMinutes);
          const midMinute = (block.startMinutes + dur / 2) % MINUTES_IN_DAY;
          const midAng = minutesToSvgAngle(midMinute, dialConfig.zeroPosition);
          const labelPos = polarToCartesian(CX, CY, R_ARC_MID, midAng);

          return (
            <g
              key={block.id}
              className="cursor-pointer transition-opacity duration-150"
              onPointerEnter={() => setHoveredBlockId(block.id)}
              onPointerLeave={() => setHoveredBlockId(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBlock(block.id);
              }}
            >
              <path
                d={path}
                fill={meta.color}
                fillOpacity={
                  isSelected ? 0.94 : isHovered ? 0.86 : isActiveNow ? 0.85 : 0.72
                }
                stroke={
                  isSelected
                    ? isDark
                      ? '#FFFFFF'
                      : '#111315'
                    : palette.faceBg
                }
                strokeWidth={isSelected ? '2.5' : '1.5'}
              />

              {dialConfig.showLabelsOnRing && dur >= 90 && !compact && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  fontSize="10.5"
                  fontWeight="600"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  pointerEvents="none"
                >
                  {truncateTitle(block.title, dur >= 180 ? 14 : 8)}
                </text>
              )}
            </g>
          );
        })}

        {/* Live Draw-New Preview Arc */}
        {dragState?.kind === 'draw-new' &&
          getDurationMinutes(dragState.anchorMinute, dragState.currentMinute) >=
            dialConfig.snapMinutes && (
            <path
              d={describeAnnularArc(
                CX,
                CY,
                R_ARC_INNER + 2,
                R_ARC_OUTER - 2,
                minutesToSvgAngle(dragState.anchorMinute, dialConfig.zeroPosition),
                minutesToSvgAngle(dragState.currentMinute, dialConfig.zeroPosition)
              )}
              fill={palette.handColor}
              fillOpacity="0.35"
              stroke={palette.handColor}
              strokeWidth="2"
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}

        {/* Drag Handles on Selected Block */}
        {selectedBlock && !compact && (
          <g>
            {[
              {
                kind: 'resize-start' as const,
                minute: selectedBlock.startMinutes,
                fixed: selectedBlock.endMinutes,
              },
              {
                kind: 'resize-end' as const,
                minute: selectedBlock.endMinutes,
                fixed: selectedBlock.startMinutes,
              },
            ].map((handle) => {
              const ang = minutesToSvgAngle(handle.minute, dialConfig.zeroPosition);
              const pos = polarToCartesian(CX, CY, R_ARC_MID, ang);
              return (
                <g
                  key={handle.kind}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    if (handle.kind === 'resize-start') {
                      setDragState({
                        kind: 'resize-start',
                        blockId: selectedBlock.id,
                        fixedEnd: handle.fixed,
                      });
                    } else {
                      setDragState({
                        kind: 'resize-end',
                        blockId: selectedBlock.id,
                        fixedStart: handle.fixed,
                      });
                    }
                  }}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="11"
                    fill="transparent"
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="6.5"
                    fill="#FFFFFF"
                    stroke="#111315"
                    strokeWidth="2.5"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* Inner Chronometer Hub */}
        <circle
          cx={CX}
          cy={CY}
          r={R_HUB}
          fill={palette.hubBg}
          stroke={palette.ringStroke}
          strokeWidth="1.2"
          className={!isLiveMode && !compact ? 'cursor-pointer' : ''}
          onPointerDown={handleRingPointerDown}
        />

        {/* Subtle 00-24 Scale Label Inside Top of Hub */}
        <text
          x={CX}
          y={CY - 86}
          textAnchor="middle"
          fill={palette.hubSecondary}
          fontSize="10.5"
          fontWeight="600"
          letterSpacing="0.14em"
          fontFamily="Outfit, sans-serif"
          pointerEvents="none"
        >
          {`391K · 00–24 · DAY ${resolvedDayInfo.dayOfWeekIndex}/9`}
        </text>

        {/* Live Weekday, Day Number & Year */}
        <text
          x={CX}
          y={CY - 58}
          textAnchor="middle"
          fill={palette.hubPrimary}
          fontSize="12"
          fontWeight="500"
          fontFamily="Plus Jakarta Sans, sans-serif"
          pointerEvents="none"
        >
          {dateReadout}
        </text>

        {/* Sweeping Time Hand (drawn behind center text cap? No, subtle outer needle + hub dot!) */}
        <line
          x1={handTail.x}
          y1={handTail.y}
          x2={handTip.x}
          y2={handTip.y}
          stroke={palette.handColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeOpacity="0.28"
          pointerEvents="none"
        />
        {/* Highlighted Needle Segment Outside Hub */}
        {(() => {
          const hubEdge = polarToCartesian(CX, CY, R_HUB, handAngle);
          return (
            <line
              x1={hubEdge.x}
              y1={hubEdge.y}
              x2={handTip.x}
              y2={handTip.y}
              stroke={palette.handColor}
              strokeWidth="2.6"
              strokeLinecap="round"
              pointerEvents="none"
            />
          );
        })()}

        {/* Live Seconds Perimeter Marker Inside Hub */}
        {dialConfig.showSecondsHand && (
          <circle
            cx={secDot.x}
            cy={secDot.y}
            r="3"
            fill={palette.handColor}
            fillOpacity="0.8"
            pointerEvents="none"
          />
        )}

        {/* Center Digital Time Readout */}
        <text
          x={CX}
          y={CY - 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill={palette.hubPrimary}
          fontSize="42"
          fontWeight="600"
          fontFamily="JetBrains Mono, monospace"
          pointerEvents="none"
        >
          {formattedClock}
        </text>

        {/* Active / Inspected Block Summary in Hub */}
        {inspectedBlock ? (
          <g pointerEvents="none">
            <text
              x={CX}
              y={CY + 24}
              textAnchor="middle"
              fill={CATEGORY_META[inspectedBlock.category].color}
              fontSize="13.5"
              fontWeight="600"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {truncateTitle(inspectedBlock.title, 22)}
            </text>
            <text
              x={CX}
              y={CY + 46}
              textAnchor="middle"
              fill={palette.hubSecondary}
              fontSize="12"
              fontWeight="500"
              fontFamily="JetBrains Mono, monospace"
            >
              {`${formatMinutes(inspectedBlock.startMinutes)}–${formatMinutes(
                inspectedBlock.endMinutes,
                true
              )} · ${
                isMinuteInBlock(currentMinutes, inspectedBlock)
                  ? `${formatDuration(
                      getRemainingMinutesInBlock(currentMinutes, inspectedBlock)
                    )} left`
                  : formatDuration(
                      getDurationMinutes(
                        inspectedBlock.startMinutes,
                        inspectedBlock.endMinutes
                      )
                    )
              }`}
            </text>
          </g>
        ) : (
          <g pointerEvents="none">
            <text
              x={CX}
              y={CY + 24}
              textAnchor="middle"
              fill={palette.hubSecondary}
              fontSize="13"
              fontWeight="500"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              Unscheduled window
            </text>
            {!compact && (
              <text
                x={CX}
                y={CY + 45}
                textAnchor="middle"
                fill={palette.hubSecondary}
                fontSize="11.5"
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                Drag on ring to add block
              </text>
            )}
          </g>
        )}

        {/* Mode Hint at Bottom of Hub */}
        <text
          x={CX}
          y={CY + 84}
          textAnchor="middle"
          fill={palette.hubSecondary}
          fontSize="11"
          fontWeight="500"
          fontFamily="JetBrains Mono, monospace"
          pointerEvents="none"
        >
          {dragState?.kind === 'draw-new'
            ? `${formatMinutes(dragState.anchorMinute)} → ${formatMinutes(
                dragState.currentMinute === 0 ? 1440 : dragState.currentMinute,
                true
              )}`
            : isLiveMode
            ? 'Live 24h cycle'
            : 'Preview scrub'}
        </text>
      </svg>
    </div>
  );
};
