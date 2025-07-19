'use client';

import React, { useState } from 'react';
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
import { StreamDeckDevice, StreamDeckButton } from '@/types/streamdeck';
import { useButtons, useUpdateButton } from '@/hooks/useButtons';
import { useRealTimeEvents } from '@/hooks/useRealTimeEvents';

interface ButtonGridProps {
  device: StreamDeckDevice;
  onButtonClick?: (button: StreamDeckButton | null, position: number) => void;
  className?: string;
}

interface SortableButtonProps {
  button: StreamDeckButton | null;
  position: number;
  isPressed?: boolean;
  onClick?: () => void;
}

function SortableButton({
  button,
  position,
  isPressed = false,
  onClick,
}: SortableButtonProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        relative aspect-square bg-gray-900 rounded-lg border-2 border-gray-700 
        cursor-pointer transition-all duration-150 hover:border-gray-500
        ${isPressed ? 'scale-95 border-blue-500' : ''}
        ${isDragging ? 'opacity-50' : ''}
        ${button ? 'hover:shadow-lg' : 'hover:bg-gray-800'}
      `}
      onClick={onClick}
    >
      {button ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-2">
          {button.icon && (
            <div className="flex-1 flex items-center justify-center mb-1">
              <img
                src={button.icon}
                alt={button.title || 'Button icon'}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
          {button.title && (
            <div
              className="text-center text-xs font-medium truncate w-full"
              style={{
                color: button.textColor || '#ffffff',
                fontSize: button.fontSize ? `${button.fontSize}px` : '12px',
              }}
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

export default function ButtonGrid({
  device,
  onButtonClick,
  className = '',
}: ButtonGridProps) {
  const { data: buttons, isLoading, error } = useButtons(device.id);
  const updateButton = useUpdateButton();
  const [pressedButtons, setPressedButtons] = useState<Set<number>>(new Set());

  useRealTimeEvents({
    onButtonPressed: (deviceId, buttonPosition) => {
      if (deviceId === device.id) {
        setPressedButtons((prev) => new Set(prev).add(buttonPosition));
      }
    },
    onButtonReleased: (deviceId, buttonPosition) => {
      if (deviceId === device.id) {
        setPressedButtons((prev) => {
          const newSet = new Set(prev);
          newSet.delete(buttonPosition);
          return newSet;
        });
      }
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const buttonMap = new Map<number, StreamDeckButton>();
  buttons?.forEach((button) => {
    buttonMap.set(button.position, button);
  });

  const gridButtons = Array.from({ length: device.buttonCount }, (_, index) => {
    return buttonMap.get(index) || null;
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = Number(active.id);
      const newIndex = Number(over.id);

      const oldButton = buttonMap.get(oldIndex);
      const newButton = buttonMap.get(newIndex);

      try {
        if (oldButton) {
          await updateButton.mutateAsync({
            deviceId: device.id,
            buttonId: oldButton.id,
            config: { position: newIndex },
          });
        }

        if (newButton) {
          await updateButton.mutateAsync({
            deviceId: device.id,
            buttonId: newButton.id,
            config: { position: oldIndex },
          });
        }
      } catch (error) {
        console.error('Failed to reorder buttons:', error);
      }
    }
  };

  const handleButtonClick = (position: number) => {
    const button = buttonMap.get(position) || null;
    onButtonClick?.(button, position);
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Button Configuration
          </h3>
          <p className="text-sm text-gray-500">Loading buttons...</p>
        </div>
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${device.columns}, minmax(0, 1fr))`,
          }}
        >
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
      <div className={`${className}`}>
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
    <div className={`${className}`}>
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
        <SortableContext
          items={Array.from({ length: device.buttonCount }, (_, i) => i)}
          strategy={rectSortingStrategy}
        >
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${device.columns}, minmax(0, 1fr))`,
            }}
          >
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
