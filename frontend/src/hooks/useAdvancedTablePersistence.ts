import { useCallback } from 'react';
import { GridApi, ColumnState, FilterModel } from 'ag-grid-community';

// Interface for the state that will be persisted
interface AdvancedTableState {
  selectedColumns: string[];
  searchTerm: string;
  expandedGroup: string;
  gridState: {
    columnState?: ColumnState[];
    filterModel?: FilterModel;
    sortModel?: unknown[]; // AG-Grid sort model format varies by version
  };
}

const STORAGE_KEY = 'advanced-table-state';

// Custom hook to manage advanced table state persistence
export function useAdvancedTablePersistence() {
  
  // Load state from session storage
  const loadState = useCallback((): Partial<AdvancedTableState> => {
    if (globalThis.window === undefined) return {};
    
    try {
      const savedState = sessionStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        console.log('Loaded table state from session storage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading table state from session storage:', error);
    }
    
    return {};
  }, []);

  // Save state to session storage
  const saveState = useCallback((state: Partial<AdvancedTableState>) => {
    if (globalThis.window === undefined) return;
    
    try {
      const currentState = loadState();
      const newState = { ...currentState, ...state };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      console.log('Saved table state to session storage:', newState);
    } catch (error) {
      console.error('Error saving table state to session storage:', error);
    }
  }, [loadState]);

  // Save grid-specific state (columns, filters, sorting)
  const saveGridState = useCallback((gridApi: GridApi) => {
    if (!gridApi) return;
    
    try {
      // Get filter model
      const filterModel = gridApi.getFilterModel();

      // Get column state
      const columnState = gridApi.getColumnState();

      let sortModel: unknown[] = [];
      try {
        // Try to get sort model - AG-Grid Community should support this
        const gridWithSort = gridApi as unknown as { getSortModel?: () => unknown[] };
        sortModel = gridWithSort.getSortModel?.() || [];
      } catch {
        // Sort model not available
      }

      const gridState = {
        columnState: columnState,
        filterModel: filterModel,
        sortModel: sortModel,
      };
      
      saveState({ gridState });
    } catch (error) {
      console.error('Error saving grid state:', error);
    }
  }, [saveState]);

  // Restore grid-specific state
  const restoreGridState = useCallback((gridApi: GridApi, isMobile?: boolean) => {
    if (!gridApi) return;
    
    try {
      const state = loadState();
      if (!state.gridState) return;

      // Restore column state (order, width, visibility)
      const restoreColumns = (colState?: ColumnState[]) => {
        if (!colState) return;
        let columnState = colState;

        // If we're on mobile, remove pinning from basic columns to ensure responsive behavior
        if (isMobile) {
          columnState = columnState.map(col => {
            if (col.colId === 'label_id' || col.colId === 'label_name' || col.colId === 'label_type') {
              return { ...col, pinned: null };
            }
            return col;
          });
        }

        gridApi.applyColumnState({
          state: columnState,
          applyOrder: true,
        });
      };

      // Restore filter model
      const restoreFilters = (filterModel?: FilterModel) => {
        if (!filterModel) return;
        gridApi.setFilterModel(filterModel);
      };

      // Restore sort model (if available)
      const restoreSort = (sortModel?: unknown[]) => {
        if (!sortModel || sortModel.length === 0) return;
        try {
          const gridWithSort = gridApi as unknown as { setSortModel?: (model: unknown[]) => void };
          gridWithSort.setSortModel?.(sortModel);
        } catch {
          // Sort model restoration not available
        }
      };

      restoreColumns(state.gridState.columnState);
      restoreFilters(state.gridState.filterModel);
      restoreSort(state.gridState.sortModel);
    } catch (error) {
      console.error('Error restoring grid state:', error);
    }
  }, [loadState]);

  // Save component state (selected columns, search term, etc.)
  const saveComponentState = useCallback((state: Omit<AdvancedTableState, 'gridState'>) => {
    const stateToSave = {
      selectedColumns: state.selectedColumns,
      searchTerm: state.searchTerm,
      expandedGroup: state.expandedGroup,
    };
    saveState(stateToSave);
  }, [saveState]);

  // Clear all saved state
  const clearState = useCallback(() => {
    if (globalThis.window === undefined) return;
    
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      console.log('Cleared table state from session storage');
    } catch (error) {
      console.error('Error clearing table state:', error);
    }
  }, []);

  return {
    loadState,
    saveState,
    saveGridState,
    restoreGridState,
    saveComponentState,
    clearState,
  };
}

export type { AdvancedTableState };