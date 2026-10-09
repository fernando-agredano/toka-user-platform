import { Email } from '../value-objects/email';
import { PersonName } from '../value-objects/person-name';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface UserProps {
  id: string;
  email: Email;
  firstName: PersonName;
  lastName: PersonName;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Every mutator returns whether the state actually changed, so callers emit events only on real transitions. */
export class User {
  private constructor(private props: UserProps) {}

  static create(input: { id: string; email: Email; firstName: PersonName; lastName: PersonName }): User {
    const now = new Date();
    return new User({ ...input, status: 'ACTIVE', createdAt: now, updatedAt: now });
  }

  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get firstName(): PersonName {
    return this.props.firstName;
  }

  get lastName(): PersonName {
    return this.props.lastName;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateProfile(changes: { firstName?: PersonName; lastName?: PersonName }): boolean {
    const firstName = changes.firstName ?? this.props.firstName;
    const lastName = changes.lastName ?? this.props.lastName;
    if (firstName.value === this.props.firstName.value && lastName.value === this.props.lastName.value) return false;
    this.props = { ...this.props, firstName, lastName };
    this.touch();
    return true;
  }

  deactivate(): boolean {
    return this.changeStatus('INACTIVE');
  }

  activate(): boolean {
    return this.changeStatus('ACTIVE');
  }

  private changeStatus(status: UserStatus): boolean {
    if (this.props.status === status) return false;
    this.props = { ...this.props, status };
    this.touch();
    return true;
  }

  private touch(): void {
    this.props = { ...this.props, updatedAt: new Date() };
  }
}
