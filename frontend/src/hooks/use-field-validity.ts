import { type FieldValues, type FormState, type Path, get } from 'react-hook-form';

/**
 * Returns a predicate telling whether a field has been touched, edited and passes validation.
 * Read `formState` during render (as here) so react-hook-form keeps tracking those properties.
 */
export const fieldValidity =
  <Values extends FieldValues>({ touchedFields, dirtyFields, errors }: FormState<Values>) =>
  (name: Path<Values>): boolean =>
    Boolean(get(touchedFields, name) && get(dirtyFields, name) && !get(errors, name));
