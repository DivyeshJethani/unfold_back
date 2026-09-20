import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      getMe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register with the dto and return the response', async () => {
      const dto: RegisterDto = {
        email: 'student@example.com',
        password: 'password123',
        name: 'Test Student',
      };
      const expectedResponse = {
        accessToken: 'jwt-token',
        user: { id: 'u1', email: 'student@example.com', name: 'Test Student', role: 'STUDENT' },
        student: { id: 's1', standardId: '10', boardId: 'CBSE', streamId: 'SCIENCE' },
      };
      authService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('login', () => {
    it('should call authService.login with the dto and return token response', async () => {
      const dto: LoginDto = {
        email: 'student@example.com',
        password: 'password123',
      };
      const expectedResponse = {
        accessToken: 'jwt-token',
        user: { id: 'u1', email: 'student@example.com', name: 'Test Student', role: 'STUDENT' },
        student: { id: 's1', standardId: '10', boardId: 'CBSE', streamId: 'SCIENCE' },
      };
      authService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getMe', () => {
    it('should call authService.getMe with current user userId', async () => {
      const currentUser: AuthenticatedUser = {
        userId: 'u1',
        studentId: 's1',
        email: 'student@example.com',
        role: 'STUDENT',
      };
      const expectedProfile = {
        user: { id: 'u1', email: 'student@example.com', name: 'Test Student' },
        student: { id: 's1', standardId: '10' },
      };
      authService.getMe.mockResolvedValue(expectedProfile);

      const result = await controller.getMe(currentUser);

      expect(authService.getMe).toHaveBeenCalledWith('u1');
      expect(result).toEqual(expectedProfile);
    });
  });
});
