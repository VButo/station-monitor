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
    if (typeof window === 'undefined') return {};
    
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
    if (typeof window === 'undefined') return;
    
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
  const restoreGridState = useCallback((gridApi: GridApi) => {
    if (!gridApi) return;
    
    try {
      const state = loadState();
      
      if (state.gridState) {
        // Restore column state (order, width, visibility)
        if (state.gridState.columnState) {
          gridApi.applyColumnState({
            state: state.gridState.columnState,
            applyOrder: true,
          });
        }
        
        // Restore filter model
        if (state.gridState.filterModel) {
          gridApi.setFilterModel(state.gridState.filterModel);
        }
        
        // Restore sort model (if available)
        if (state.gridState.sortModel && state.gridState.sortModel.length > 0) {
          try {
            const gridWithSort = gridApi as unknown as { setSortModel?: (model: unknown[]) => void };
            gridWithSort.setSortModel?.(state.gridState.sortModel);
          } catch {
            // Sort model restoration not available
          }
        }
      }
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
    if (typeof window === 'undefined') return;
    
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