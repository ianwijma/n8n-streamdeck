'use client';

import React, { useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DeviceResponse, ButtonResponse } from '@/types/api';
import Icon from '@/components/ui/Icon';

interface ButtonGridProps {
  device: DeviceResponse;
  buttons?: ButtonResponse[];
  isLoading?: boolean;
  error?: Error | null;
  pressedButtons?: Set<number>;
  onButtonClick?: (button: ButtonResponse | null, position: number) => void;
  onButtonReorder?: (
    oldIndex: number,
    newIndex: number,
    oldButton: ButtonResponse | null,
    newButton: ButtonResponse | null
  ) => Promise<void>;
  className?: string;
}

interface SortableButtonProps {
  button: ButtonResponse | null;
  position: number;
  isPressed?: boolean;
  onClick?: () => void;
}

const SortableButton = React.memo<SortableButtonProps>(
  ({ button, position, isPressed = false, onClick }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: position });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const buttonClassName = useMemo(
      () => `
    group relative aspect-square bg-gray-800 rounded-lg border border-gray-600
    cursor-pointer transition-all duration-150 hover:border-gray-400
    ${isPressed ? 'scale-95 border-blue-400 shadow-lg shadow-blue-500/50' : ''}
    ${isDragging ? 'opacity-50' : ''}
    ${button ? 'hover:shadow-lg hover:bg-gray-700' : 'hover:bg-gray-700'}
    w-16 h-16 min-w-[4rem] min-h-[4rem]
  `,
      [isPressed, isDragging, button]
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        // Only handle click if we're not dragging
        if (!isDragging) {
          e.stopPropagation();
          onClick?.();
        }
      },
      [onClick, isDragging]
    );

    const buttonTextStyle = useMemo(
      () => ({
        color: button?.textColor || '#ffffff',
        fontSize: button?.fontSize ? `${button.fontSize}px` : '12px',
      }),
      [button?.textColor, button?.fontSize]
    );

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={buttonClassName}
        {...attributes}
      >
        {/* Drag handle - visible on hover */}
        <div
          className="absolute top-1 right-1 w-4 h-4 bg-gray-700 rounded-sm opacity-0 group-hover:opacity-80 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
          {...listeners}
          title="Drag to reorder"
        >
          <svg
            className="w-2.5 h-2.5 text-gray-300"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M7 2a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V4a2 2 0 00-2-2H7zM7 10a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H7zM13 2a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V4a2 2 0 00-2-2h-2zM13 10a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
          </svg>
        </div>

        {/* Main clickable area */}
        <div className="absolute inset-0 cursor-pointer" onClick={handleClick}>
          {button ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-2">
              {button.icon && (
                <div className="flex-1 flex items-center justify-center mb-1">
                  <Icon
                    src={button.icon}
                    alt={button.title || 'Button icon'}
                    size="md"
                  />
                </div>
              )}
              {button.title && (
                <div
                  className="text-center text-xs font-medium truncate w-full"
                  style={buttonTextStyle}
                >
                  {button.title}
                </div>
              )}
              {!button.enabled && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
                    />
                  </svg>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-gray-500 text-xs">
                <svg
                  className="w-6 h-6 mx-auto mb-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <div>Empty</div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute top-0.5 left-0.5 text-[10px] text-gray-500 font-mono bg-gray-900/80 rounded px-1 pointer-events-none">
          {position + 1}
        </div>
      </div>
    );
  }
);

SortableButton.displayName = 'SortableButton';

const ButtonGrid = React.memo<ButtonGridProps>(
  ({
    device,
    buttons = [],
    isLoading = false,
    error = null,
    pressedButtons = new Set(),
    onButtonClick,
    onButtonReorder,
    className = '',
  }) => {
    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    const buttonMap = useMemo(() => {
      const map = new Map<number, ButtonResponse>();
      buttons.forEach((button) => {
        map.set(button.position, button);
      });
      return map;
    }, [buttons]);

    const gridButtons = useMemo(
      () =>
        Array.from({ length: device.buttonCount }, (_, index) => {
          return buttonMap.get(index) || null;
        }),
      [device.buttonCount, buttonMap]
    );
    const handleDragEnd = useCallback(
      async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && onButtonReorder) {
          const oldIndex = Number(active.id);
          const newIndex = Number(over.id);

          const oldButton = buttonMap.get(oldIndex);
          const newButton = buttonMap.get(newIndex);

          try {
            await onButtonReorder(
              oldIndex,
              newIndex,
              oldButton || null,
              newButton || null
            );
          } catch (error) {
            console.error('Failed to reorder buttons:', error);
          }
        }
      },
      [onButtonReorder, buttonMap]
    );

    const handleButtonClick = useCallback(
      (position: number) => {
        const button = buttonMap.get(position) || null;
        onButtonClick?.(button, position);
      },
      [onButtonClick, buttonMap]
    );

    const gridStyle = useMemo(
      () => ({
        gridTemplateColumns: `repeat(${device.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${device.rows}, minmax(0, 1fr))`,
        gap: '8px',
      }),
      [device.columns, device.rows]
    );

    const deviceContainerStyle = useMemo(() => {
      // Adjust container styling based on device type
      const isXL = device.buttonCount === 32;
      const isMini = device.buttonCount === 6;

      return {
        padding: isXL ? '24px' : isMini ? '16px' : '20px',
        borderRadius: isXL ? '24px' : '20px',
      };
    }, [device.buttonCount]);

    const sortableItems = useMemo(
      () => Array.from({ length: device.buttonCount }, (_, i) => i),
      [device.buttonCount]
    );

    if (isLoading) {
      return (
        <div className={className}>
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Button Configuration
            </h3>
            <p className="text-sm text-gray-500">Loading buttons...</p>
          </div>
          <div
            className="inline-block bg-gray-900 shadow-2xl"
            style={deviceContainerStyle}
          >
            <div className="bg-black rounded-xl p-4">
              <div className="grid" style={gridStyle}>
                {Array.from({ length: device.buttonCount }).map((_, index) => (
                  <div
                    key={index}
                    className="w-16 h-16 bg-gray-600 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 text-center">
              <div className="text-white text-sm font-medium">
                {device.name}
              </div>
              <div className="text-gray-400 text-xs">Loading buttons...</div>
              <div className="text-gray-500 text-[10px] mt-1">
                Model: {device.model}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={className}>
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Button Configuration
            </h3>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-400 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800">
                  Failed to load buttons
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  {error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={className}>
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Button Configuration
          </h3>
          <p className="text-sm text-gray-500">
            Click a button to configure it, or drag to reorder
          </p>
        </div>

        {/* StreamDeck Device Container */}
        <div
          className="inline-block bg-gray-900 shadow-2xl"
          style={deviceContainerStyle}
        >
          <div className="bg-black rounded-xl p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableItems}
                strategy={rectSortingStrategy}
              >
                <div className="grid" style={gridStyle}>
                  {gridButtons.map((button, index) => (
                    <SortableButton
                      key={index}
                      button={button}
                      position={index}
                      isPressed={pressedButtons.has(index)}
                      onClick={() => handleButtonClick(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Device Info */}
          <div className="mt-4 text-center">
            <div className="text-white text-sm font-medium">{device.name}</div>
            <div className="text-gray-400 text-xs">
              {device.columns}×{device.rows} • {device.buttonCount} buttons
            </div>
            <div className="text-gray-500 text-[10px] mt-1">
              Model: {device.model}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>• Click any button to configure its action and appearance</p>
          <p>• Drag buttons to reorder them on your StreamDeck</p>
          <p>• Numbers in the top-left show the physical button position</p>
        </div>
      </div>
    );
  }
);

ButtonGrid.displayName = 'ButtonGrid';

export default ButtonGrid;
