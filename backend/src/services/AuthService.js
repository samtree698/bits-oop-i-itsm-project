const crypto = require('crypto');
const { UserFactory } = require('../patterns/factory/EntityFactory');
const {
  InvalidLoginException,
  InvalidUserInputException,
  UnauthorizedOperationException
} = require('../exceptions/AppExceptions');

class AuthService {
  constructor(userRepository, secret = process.env.JWT_SECRET || 'bits_pilani_oop_i_itsm_secret_key_2026') {
    this.userRepository = userRepository;
    this.secret = secret;
  }

  signToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
      })
    ).toString('base64url');
    const signature = crypto.createHmac('sha256', this.secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedOperationException('Missing authentication token.');
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedOperationException('Malformed authentication token.');
    }
    const [header, payload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', this.secret).update(`${header}.${payload}`).digest('base64url');
    if (signature !== expectedSig) {
      throw new UnauthorizedOperationException('Invalid token signature.');
    }
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedOperationException('Authentication token has expired.');
    }
    return decoded;
  }

  async registerEmployee({ name, email, password, department = 'Engineering', location = 'Hyderabad Campus' }) {
    if (!name || !email || !password) {
      throw new InvalidUserInputException('Name, email, and password are required to register.');
    }
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new InvalidUserInputException(`An account with email '${email}' already exists.`);
    }
    const employee = UserFactory.createUser({
      name,
      email,
      password,
      role: 'EMPLOYEE',
      department,
      location
    });
    await this.userRepository.save(employee);
    const token = this.signToken(employee);
    return { user: employee.toJSON(), token };
  }

  async login({ email, password }) {
    if (!email || !password) {
      throw new InvalidLoginException('Both email and password are required.');
    }
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.active) {
      throw new InvalidLoginException('Invalid email or password credentials.');
    }
    if (!user.verifyPassword(password)) {
      throw new InvalidLoginException('Invalid email or password credentials.');
    }
    const token = this.signToken(user);
    return { user: user.toJSON(), token };
  }
}

module.exports = { AuthService };
