import { Email } from '../value-objects/email';

export interface CredentialProps {
  id: string;
  email: Email;
  passwordHash: string;
  active: boolean;
  createdAt: Date;
}

export class Credential {
  private constructor(private props: CredentialProps) {}

  static create(input: { id: string; email: Email; passwordHash: string }): Credential {
    return new Credential({ ...input, active: true, createdAt: new Date() });
  }

  static restore(props: CredentialProps): Credential {
    return new Credential({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get isActive(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  deactivate(): void {
    this.props.active = false;
  }

  activate(): void {
    this.props.active = true;
  }
}
