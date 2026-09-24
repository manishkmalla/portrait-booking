import { Clock2Icon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Calendar } from '../components/ui/calendar';
import { Card, CardContent, CardFooter } from '../components/ui/card';
import { Field, FieldGroup, FieldLabel } from '../components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '../components/ui/input-group';
import { apiFetch } from '../lib/api';
import { startOfToday } from '../lib/date';
import type { Slot } from '../types';

function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(hours ?? 0, minutes ?? 0, seconds ?? 0, 0);
  return combined;
}

export function CreateSlotPage() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('10:00:00');
  const [endTime, setEndTime] = useState('11:00:00');
  const [capacity, setCapacity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!date) {
      setError('Pick a date on the calendar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch<Slot>('/api/slots', {
        method: 'POST',
        body: JSON.stringify({
          startsAt: combineDateAndTime(date, startTime).toISOString(),
          endsAt: combineDateAndTime(date, endTime).toISOString(),
          capacity: Number(capacity),
        }),
      });
      setStartTime('10:00:00');
      setEndTime('11:00:00');
      setCapacity('1');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>Create Slot</h2>
      <form onSubmit={handleSubmit}>
        {/* Same shape as shadcn's own "Date and Time Picker" example:
            Card + CardContent(Calendar) + CardFooter(FieldGroup of time fields). */}
        <Card className="w-fit p-0">
          <CardContent className="p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: startOfToday() }}
              className="[--cell-size:2.75rem] p-0 md:[--cell-size:3rem]"
            />
          </CardContent>
          <CardFooter className="border-t bg-card">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="start-time">Start Time</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="start-time"
                    type="time"
                    step="1"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                  <InputGroupAddon>
                    <Clock2Icon className="text-muted-foreground" />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="end-time">End Time</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="end-time"
                    type="time"
                    step="1"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                  <InputGroupAddon>
                    <Clock2Icon className="text-muted-foreground" />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="capacity">Capacity</FieldLabel>
                <input
                  id="capacity"
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  required
                />
              </Field>
            </FieldGroup>
          </CardFooter>
        </Card>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">Slot created.</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create slot'}
        </button>
      </form>
    </section>
  );
}
