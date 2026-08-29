'use client';

import { FormEvent, useState } from 'react';

type Mode = 'staff' | 'manager';

const shifts = [
  { id: 'setup', label: 'Morning setup', time: '9:00 am – 1:00 pm', note: 'Set up the stall, prep equipment and welcome the first guests.', capacity: 4, claimed: 2 },
  { id: 'service', label: 'Festival service', time: '1:00 pm – 7:00 pm', note: 'Serve guests, restock and keep the stall running smoothly.', capacity: 4, claimed: 3 },
];

const claimants = [
  { id: 'riley', initials: 'RK', name: 'Riley Kim', shift: 'Morning setup', status: 'Provisional' },
  { id: 'jordan', initials: 'JB', name: 'Jordan Bell', shift: 'Morning setup', status: 'Provisional' },
  { id: 'sam', initials: 'ST', name: 'Sam Taylor', shift: 'Festival service', status: 'Provisional' },
  { id: 'casey', initials: 'CA', name: 'Casey Allen', shift: 'Festival service', status: 'Provisional' },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>('staff');
  const [reserved, setReserved] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<string | null>(null);
  const [showStates, setShowStates] = useState(false);

  function toggleReservation(id: string, label: string) {
    const isReserved = reserved.includes(id);
    setReserved((current) => isReserved ? current.filter((shiftId) => shiftId !== id) : [...current, id]);
    setMessage(isReserved
      ? `${label} is available again.`
      : `${label} is provisionally reserved. The manager still confirms the final roster.`);
  }

  function toggleConfirmation(id: string, name: string) {
    const isConfirmed = confirmed.includes(id);
    setConfirmed((current) => isConfirmed ? current.filter((staffId) => staffId !== id) : [...current, id]);
    setMessage(isConfirmed ? `${name} returned to provisional.` : `${name} is confirmed in this local preview.`);
  }

  function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('eventName') || '').trim();
    setCreatedEvent(name);
    setShowCreate(false);
    setMessage(`${name} was added to this device preview. It is not saved or shared.`);
    event.currentTarget.reset();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="StamStaff home"><span className="brand-mark" aria-hidden="true">S</span><span>StamStaff</span></a>
        <div className="preview-switch" aria-label="Preview role">
          <span>Preview as</span>
          <div>
            <button className={mode === 'staff' ? 'selected' : ''} type="button" onClick={() => setMode('staff')}>Staff</button>
            <button className={mode === 'manager' ? 'selected' : ''} type="button" onClick={() => setMode('manager')}>Manager</button>
          </div>
        </div>
        <button className="profile-button" type="button" aria-label={`Open fictional ${mode} profile`}>
          <span className="avatar" aria-hidden="true">{mode === 'staff' ? 'R' : 'M'}</span>
          <span className="profile-copy"><strong>{mode === 'staff' ? 'Riley' : 'Morgan'}</strong><small>{mode === 'staff' ? 'Staff' : 'Manager'} preview</small></span>
        </button>
      </header>

      <div className="demo-banner" role="note"><strong>Interactive prototype</strong><span>Fictional local data only — role switching is not authentication; changes are not saved or shared.</span></div>

      {mode === 'staff' ? (
        <StaffView reserved={reserved} setMessage={setMessage} toggleReservation={toggleReservation} showStates={showStates} setShowStates={setShowStates} />
      ) : (
        <ManagerView confirmed={confirmed} createdEvent={createdEvent} setShowCreate={setShowCreate} toggleConfirmation={toggleConfirmation} />
      )}

      {showCreate && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-event-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="step">Local preview</span><h2 id="new-event-title">Add an event</h2></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Close event form">×</button></div>
            <p className="form-intro">Start with the essentials. More detail can be added later, once the team knows what it needs.</p>
            <form onSubmit={addEvent}>
              <label>Event name<input name="eventName" placeholder="e.g. Riverside market" required /></label>
              <div className="form-row"><label>Date<input name="date" type="date" required /></label><label>Location<input name="location" placeholder="Suburb or venue" required /></label></div>
              <fieldset><legend>First shift</legend><div className="form-row"><label>Starts<input name="start" type="time" required /></label><label>Finishes<input name="finish" type="time" required /></label><label>Places<input name="capacity" type="number" min="1" max="20" defaultValue="4" required /></label></div></fieldset>
              <div className="form-note"><strong>Prototype note:</strong> this event stays only on this page until refresh. Do not enter real staff or customer information.</div>
              <div className="form-actions"><button className="button secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="button primary" type="submit">Add event</button></div>
            </form>
          </section>
        </div>
      )}

      <div className={`toast${message ? ' show' : ''}`} role="status" aria-live="polite"><span>{message}</span>{message && <button type="button" onClick={() => setMessage('')} aria-label="Dismiss message">×</button>}</div>
    </main>
  );
}

function StaffView({ reserved, setMessage, toggleReservation, showStates, setShowStates }: {
  reserved: string[];
  setMessage: (message: string) => void;
  toggleReservation: (id: string, label: string) => void;
  showStates: boolean;
  setShowStates: (value: boolean) => void;
}) {
  return (
    <>
      <section className="hero" id="top">
        <div className="eyebrow">Your next event</div>
        <div className="hero-grid">
          <div><p className="date-line">Saturday · 17 October</p><h1>Harbour Lights<br />Food Festival</h1><p className="hero-copy">Choose the hours that suit you. Reserving a place shows the manager you’re available.</p></div>
          <aside className="event-card" aria-label="Event details">
            <div><span className="detail-icon" aria-hidden="true">⌖</span><p><strong>Portside Lawns</strong><small>Adelaide SA · Fictional event</small></p></div>
            <div><span className="detail-icon" aria-hidden="true">◷</span><p><strong>9:00 am – 7:00 pm</strong><small>Australia/Adelaide time</small></p></div>
            <div><span className="detail-icon" aria-hidden="true">i</span><p><strong>Reservations close Thursday</strong><small>Final roster is confirmed by the manager</small></p></div>
          </aside>
        </div>
      </section>

      <section className="content" aria-labelledby="choose-heading">
        <div className="section-heading">
          <div><span className="step">Step 1 of 2</span><h2 id="choose-heading">Choose your shift</h2><p>Reserve one or both. You can release your place before reservations close.</p></div>
          <div className="legend" aria-label="Shift status key"><span><i className="dot dot-open" />Places open</span><span><i className="dot dot-yours" />Your reservation</span></div>
        </div>

        <div className="shift-list">
          {shifts.map((shift) => {
            const isReserved = reserved.includes(shift.id);
            const taken = shift.claimed + (isReserved ? 1 : 0);
            const remaining = shift.capacity - taken;
            return (
              <article className={`shift-card${isReserved ? ' is-reserved' : ''}`} key={shift.id}>
                <div className="shift-main"><div className="shift-time"><strong>{shift.time}</strong><span>{shift.label}</span></div><p>{shift.note}</p></div>
                <div className="capacity" aria-label={`${remaining} of ${shift.capacity} places remaining`}><div className="capacity-copy"><strong>{remaining} {remaining === 1 ? 'place' : 'places'} left</strong><span>{taken} of {shift.capacity} reserved</span></div><div className="place-dots" aria-hidden="true">{Array.from({ length: shift.capacity }).map((_, index) => <span className={index < taken ? 'taken' : 'open'} key={index} />)}</div></div>
                <button className={isReserved ? 'button secondary' : 'button primary'} type="button" onClick={() => toggleReservation(shift.id, shift.label)}>{isReserved ? 'Release my place' : 'Reserve a place'}</button>
                {isReserved && <div className="reserved-label">Reserved by you · Awaiting manager confirmation</div>}
              </article>
            );
          })}
        </div>

        <aside className="reassurance"><span aria-hidden="true">✓</span><p><strong>Your choice isn’t the final roster yet.</strong><span>The manager will review everyone’s availability and confirm who is working.</span></p></aside>
        <button className="states-toggle" type="button" aria-expanded={showStates} onClick={() => setShowStates(!showStates)}>{showStates ? 'Hide' : 'Preview'} important app states</button>
        {showStates && <StateGallery />}
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation"><a className="active" href="#top"><span aria-hidden="true">⌂</span>Events</a><button type="button" onClick={() => setMessage('Your provisional reservations appear above for this prototype.')}><span aria-hidden="true">▣</span>My shifts</button><button type="button" onClick={() => setMessage('Notifications are not connected in this prototype.')}><span aria-hidden="true">◌</span>Updates</button></nav>
    </>
  );
}

function ManagerView({ confirmed, createdEvent, setShowCreate, toggleConfirmation }: {
  confirmed: string[];
  createdEvent: string | null;
  setShowCreate: (value: boolean) => void;
  toggleConfirmation: (id: string, name: string) => void;
}) {
  return (
    <>
      <section className="manager-hero" id="top">
        <div><span className="eyebrow">Manager preview</span><h1>Good morning,<br />Morgan.</h1><p>Two places still need a decision for the next fictional event.</p></div>
        <button className="button light" type="button" onClick={() => setShowCreate(true)}>＋ Add an event</button>
      </section>
      <section className="manager-content">
        {createdEvent && <div className="created-event"><span aria-hidden="true">✓</span><p><strong>{createdEvent}</strong><small>Added to this local preview · not published or saved</small></p></div>}
        <div className="manager-summary">
          <article><span>Next event</span><strong>17 Oct</strong><small>Harbour Lights</small></article>
          <article><span>Total places</span><strong>8</strong><small>Across 2 shifts</small></article>
          <article><span>Provisional</span><strong>{4 - confirmed.length}</strong><small>Awaiting your decision</small></article>
          <article><span>Confirmed</span><strong>{confirmed.length}</strong><small>Final assignments</small></article>
        </div>
        <div className="roster-panel">
          <div className="roster-heading"><div><span className="step">Step 2 of 2</span><h2>Confirm the roster</h2><p>A reservation holds capacity. You still decide the final assignments.</p></div><span className="open-badge">Reservations open</span></div>
          <div className="roster-list">
            {claimants.map((person) => {
              const isConfirmed = confirmed.includes(person.id);
              return <article key={person.id}><span className="person-avatar" aria-hidden="true">{person.initials}</span><p><strong>{person.name}</strong><small>{person.shift}</small></p><span className={`status-pill ${isConfirmed ? 'confirmed' : 'provisional'}`}>{isConfirmed ? 'Confirmed' : person.status}</span><button className={isConfirmed ? 'mini-button undo' : 'mini-button'} type="button" onClick={() => toggleConfirmation(person.id, person.name)}>{isConfirmed ? 'Undo' : 'Confirm'}</button></article>;
            })}
          </div>
          <footer><p><strong>Not ready to publish?</strong><span>Your decisions stay in this preview while you explore.</span></p><button className="button primary" type="button" onClick={() => alert('Prototype only: publication and notifications are not connected.')}>Preview final roster</button></footer>
        </div>
      </section>
    </>
  );
}

function StateGallery() {
  const states = [
    ['Full', 'All places are taken. No reserve action is offered.', 'full'],
    ['Locked', 'Reservations have closed. Contact the manager for urgent changes.', 'locked'],
    ['Offline', 'Connect to reserve or release a place. No false success is shown.', 'offline'],
    ['Conflict', 'That last place was just reserved. Capacity has been refreshed.', 'conflict'],
  ];
  return <div className="state-gallery">{states.map(([title, copy, state]) => <article className={state} key={title}><span>{title}</span><p>{copy}</p></article>)}</div>;
}
