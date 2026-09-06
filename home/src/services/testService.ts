/**
 * GOATEST Test Pipeline Service
 * 
 * In PMT 1, this represents the pipeline entry / initialization stage for future:
 * Organ Selection -> B-FIT -> SHB -> COMPARE -> CONDITION
 * 
 * NO FAKE HEALTH VALUES ARE GENERATED.
 */

export interface TestPipelineStatus {
  pipelineState: 'INITIALIZING' | 'STANDBY' | 'READY_FOR_ORGAN_SELECT' | 'DEVICE_REQUIRED';
  stageName: string;
  isDeviceConnected: boolean;
  message: string;
}

export const testService = {
  /**
   * Initializes the test pipeline state.
   */
  getPipelineStatus(): TestPipelineStatus {
    return {
      pipelineState: 'STANDBY',
      stageName: 'TEST INITIALIZATION',
      isDeviceConnected: false,
      message: 'Test pipeline standby. Hardware device connection and organ selection will be available in future modules.',
    };
  }
};
