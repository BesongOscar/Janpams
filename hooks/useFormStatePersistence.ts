import { useState, useEffect, useCallback, useRef } from 'react';
import { storeData, readData, deleteData } from '@/utils/storage';

export interface UseFormStatePersistenceOptions<T> {
  /** Unique form identifier for storage key */
  formId: string;
  /** Fields to persist (user-entered data) */
  persistFields: Array<keyof T>;
  /** Fields to exclude from persistence (location-derived data) */
  excludeFields?: Array<keyof T>;
  /** Whether to auto-save on changes */
  autoSave?: boolean;
  /** Debounce delay for auto-save in ms */
  debounceMs?: number;
}

/**
 * Hook to persist form state (user inputs only) in session storage
 * Location-derived fields are excluded and should be refreshed separately
 */
export function useFormStatePersistence<T extends Record<string, any>>(
  options: UseFormStatePersistenceOptions<T>,
) {
  const {
    formId,
    persistFields,
    excludeFields = [],
    autoSave = true,
    debounceMs = 500,
  } = options;

  const storageKey = `@formState_${formId}`;
  const [isRestored, setIsRestored] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Restore persisted form state from storage
   */
  const restoreState = useCallback(async (): Promise<Partial<T> | null> => {
    try {
      const stored = await readData(storageKey);
      if (stored && isMountedRef.current) {
        setIsRestored(true);
        return stored as Partial<T>;
      }
      return null;
    } catch (error) {
      console.warn('Failed to restore form state:', error);
      return null;
    }
  }, [storageKey]);

  /**
   * Save form state to storage (only persistFields, exclude excludeFields)
   */
  const saveState = useCallback(
    async (formState: T): Promise<void> => {
      try {
        // Filter to only include persistFields and exclude excludeFields
        const fieldsToSave = persistFields.filter(
          field => !excludeFields.includes(field),
        );
        const stateToSave: Partial<T> = {};

        fieldsToSave.forEach(field => {
          if (formState[field] !== undefined && formState[field] !== null) {
            stateToSave[field] = formState[field];
          }
        });

        await storeData(storageKey, stateToSave);
      } catch (error) {
        console.warn('Failed to save form state:', error);
      }
    },
    [storageKey, persistFields, excludeFields],
  );

  /**
   * Save state with debouncing for auto-save
   */
  const saveStateDebounced = useCallback(
    (formState: T) => {
      if (!autoSave) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveState(formState);
      }, debounceMs);
    },
    [autoSave, debounceMs, saveState],
  );

  /**
   * Clear persisted form state
   */
  const clearState = useCallback(async (): Promise<void> => {
    try {
      await deleteData(storageKey);
      if (isMountedRef.current) {
        setIsRestored(false);
      }
    } catch (error) {
      console.warn('Failed to clear form state:', error);
    }
  }, [storageKey]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    restoreState,
    saveState,
    saveStateDebounced,
    clearState,
    isRestored,
  };
}

