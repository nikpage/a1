// @vitest-environment jsdom
//
// __tests__/voice-panel-load.test.js
//
// The defect: /me fetches the voice profile AFTER the panel mounts and passes it
// down as a prop, but the panel seeded its editable state in useState
// INITIALISERS only. So a saved profile rendered as empty fields — and pressing
// Save in that state posted empty lists over the real profile in the DB.
//
// Both halves are pinned here against the real component: the fields fill in
// when the profile arrives late, and the payload Save posts carries the profile
// rather than wiping it. Only fetch (the network boundary) is stubbed.

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import VoiceProfilePanel from '../components/VoiceProfilePanel';

const PROFILE = {
  list_a: ['Leads with the point, then explains.', 'Short sentences, few subordinate clauses.'],
  list_b: [{ trait: 'swears when emphatic', translation: 'states it flat, no hedging' }],
  profile_text: 'I never use exclamation marks.',
  samples: [{ text: 'a real sample of my writing' }],
  options: { cleanup: true },
};

beforeEach(() => {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ profile: PROFILE }),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The panel is closed by default (it sat in the way of every other task on the
// page), so opening it is the first step of every case here.
function openPanel() {
  fireEvent.click(screen.getByText('Open'));
}

describe('VoiceProfilePanel with a profile that arrives after mount', () => {
  test('fills the editor from the profile instead of showing it as empty', async () => {
    // Mounted with nothing, exactly as /me mounts it before its fetch returns.
    const { rerender } = render(<VoiceProfilePanel profile={null} />);
    rerender(<VoiceProfilePanel profile={PROFILE} />);
    openPanel();

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Leads with the point, then explains\./)).toBeTruthy();
    });
    expect(screen.getByDisplayValue('I never use exclamation marks.')).toBeTruthy();
    expect(screen.getByDisplayValue('states it flat, no hedging')).toBeTruthy();
    expect(screen.getByRole('checkbox').checked).toBe(true);
  });

  test('Save posts the loaded profile, never empty lists over it', async () => {
    const { rerender } = render(<VoiceProfilePanel profile={null} />);
    rerender(<VoiceProfilePanel profile={PROFILE} />);
    openPanel();

    await waitFor(() => screen.getByDisplayValue(/Leads with the point/));
    fireEvent.click(screen.getByText('Save profile'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.action).toBe('save');
    expect(body.profile.list_a).toEqual(PROFILE.list_a);
    expect(body.profile.list_b).toEqual(PROFILE.list_b);
    expect(body.profile.profile_text).toBe('I never use exclamation marks.');
    expect(body.profile.options).toEqual({ cleanup: true });
  });

  test('an edit made after the profile loaded is not overwritten by a re-render', async () => {
    const { rerender } = render(<VoiceProfilePanel profile={null} />);
    rerender(<VoiceProfilePanel profile={PROFILE} />);
    openPanel();

    const own = await waitFor(() => screen.getByDisplayValue('I never use exclamation marks.'));
    fireEvent.change(own, { target: { value: 'I write in the first person.' } });
    // Same profile object, re-rendered — a parent state change elsewhere on /me.
    rerender(<VoiceProfilePanel profile={PROFILE} />);

    expect(screen.getByDisplayValue('I write in the first person.')).toBeTruthy();
  });

  test('no profile at all still renders the sample form, with nothing claimed as saved', () => {
    render(<VoiceProfilePanel profile={null} />);
    expect(screen.getByText('not set up yet')).toBeTruthy();
    openPanel();
    expect(screen.getByText('Build my voice profile')).toBeTruthy();
  });
});
