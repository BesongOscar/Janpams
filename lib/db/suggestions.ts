/**
 * Street and neighborhood name suggestion operations (offline-first).
 * Web parity: createStreetNameSuggestion, createNeighborhoodNameSuggestion.
 */

import { getDB } from './database';
import { randomUUID } from '../randomUUID';
import type {
  StreetNameSuggestionLocal,
  NeighborhoodNameSuggestionLocal,
  OriginalSource,
} from './schemas';

/**
 * Create a new street name suggestion (offline-first).
 * Returns the created suggestion with id for linking to user_suggested address.
 */
export async function createStreetNameSuggestion(input: {
  plusCode: string;
  streetKey: string;
  suggestedName: string;
  suggestedType?: string;
  languageCode?: string;
  originalName?: string;
  originalSource: OriginalSource;
  suggestedBy?: string;
}): Promise<StreetNameSuggestionLocal> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const localId = crypto.randomUUID();
  const fullSuggestedName = input.suggestedType
    ? `${input.suggestedName} ${input.suggestedType}`
    : input.suggestedName;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO street_name_suggestions (
      id, localId, plusCode, streetKey, suggestedName, suggestedType, fullSuggestedName,
      languageCode, originalName, originalSource, aliasGroupId, isPrimaryName,
      suggestedBy, suggestedAt, status, voteCountUp, voteCountDown, reportCount, syncStatus
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      localId,
      input.plusCode,
      input.streetKey,
      input.suggestedName,
      input.suggestedType ?? null,
      fullSuggestedName,
      input.languageCode ?? 'en',
      input.originalName ?? null,
      input.originalSource,
      null,
      0,
      input.suggestedBy ?? null,
      now,
      'pending',
      0,
      0,
      0,
      'pending',
    ]
  );

  return {
    id,
    localId,
    plusCode: input.plusCode,
    streetKey: input.streetKey,
    suggestedName: input.suggestedName,
    suggestedType: input.suggestedType,
    fullSuggestedName,
    languageCode: input.languageCode ?? 'en',
    originalName: input.originalName,
    originalSource: input.originalSource,
    isPrimaryName: false,
    suggestedBy: input.suggestedBy,
    suggestedAt: now,
    status: 'pending',
    voteCountUp: 0,
    voteCountDown: 0,
    reportCount: 0,
    syncStatus: 'pending',
  };
}

/**
 * Create a new neighborhood name suggestion (offline-first).
 * Returns the created suggestion with id for linking to user_suggested address.
 */
export async function createNeighborhoodNameSuggestion(input: {
  plusCode: string;
  neighborhoodKey: string;
  suggestedName: string;
  languageCode?: string;
  originalName?: string;
  originalSource: OriginalSource;
  suggestedBy?: string;
}): Promise<NeighborhoodNameSuggestionLocal> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const localId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO neighborhood_name_suggestions (
      id, localId, plusCode, neighborhoodKey, suggestedName,
      languageCode, originalName, originalSource, aliasGroupId, isPrimaryName,
      suggestedBy, suggestedAt, status, voteCountUp, voteCountDown, reportCount, syncStatus
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      localId,
      input.plusCode,
      input.neighborhoodKey,
      input.suggestedName,
      input.languageCode ?? 'en',
      input.originalName ?? null,
      input.originalSource,
      null,
      0,
      input.suggestedBy ?? null,
      now,
      'pending',
      0,
      0,
      0,
      'pending',
    ]
  );

  return {
    id,
    localId,
    plusCode: input.plusCode,
    neighborhoodKey: input.neighborhoodKey,
    suggestedName: input.suggestedName,
    languageCode: input.languageCode ?? 'en',
    originalName: input.originalName,
    originalSource: input.originalSource,
    isPrimaryName: false,
    suggestedBy: input.suggestedBy,
    suggestedAt: now,
    status: 'pending',
    voteCountUp: 0,
    voteCountDown: 0,
    reportCount: 0,
    syncStatus: 'pending',
  };
}
