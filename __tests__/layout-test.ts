/* eslint-disable no-unused-vars */
 
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import renderer from 'react-test-renderer';

import { describe, it, expect } from '@jest/globals';

describe('mock test', () => {
  it('adds 2 numbers', () => {
    const sum = 1 + 1;
    expect(sum).toBe(2);
  });
});
