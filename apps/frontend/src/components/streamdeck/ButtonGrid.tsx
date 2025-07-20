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
    relative aspect-square bg-gray-900 rounded-lg border-2 border-gray-700 
    cursor-pointer transition-all duration-150 hover:border-gray-500
    ${isPressed ? 'scale-95 border-blue-500' : ''}
    ${isDragging ? 'opacity-50' : ''}
    ${button ? 'hover:shadow-lg' : 'hover:bg-gray-800'}
  `,
      [isPressed, isDragging, button]
    );

    const handleClick = useCallback(() => {
      onClick?.();
    }, [onClick]);

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
        {...attributes}
        {...listeners}
        className={buttonClassName}
        onClick={handleClick}
      >
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

        <div className="absolute top-1 left-1 text-xs text-gray-400 font-mono">
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
      }),
      [device.columns]
    );

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
          <div className="grid gap-3" style={gridStyle}>
            {Array.from({ length: device.buttonCount }).map((_, index) => (
              <div
                key={index}
                className="aspect-square bg-gray-200 rounded-lg animate-pulse"
              />
            ))}
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableItems} strategy={rectSortingStrategy}>
            <div className="grid gap-3" style={gridStyle}>
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
