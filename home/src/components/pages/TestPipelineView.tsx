/**
 * GOATEST Test View
 * 
 * Clean minimal view for the Test tab.
 * Renders the universal LoadingPage with top and bottom navigation remaining active.
 */

import React from 'react';
import { LoadingPage } from './LoadingPage';

export const TestPipelineView: React.FC = () => {
  return <LoadingPage title="Test" subtext="Loading..." />;
};
