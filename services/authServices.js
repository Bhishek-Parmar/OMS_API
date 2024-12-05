import { ROLES, isValidRole } from "../utils/constant";
import { User, SuperAdmin, HotelOwner } from '../models/userModel.js';
import DevKey from '../models/devKeyModel.js';
import { validateDevKey, generateToken } from "../utils"
import { ClientError, ServerError } from "../utils/errorHandler.js"
import bcrypt from 'bcrypt';

export const createUserWithRole = async ({ email, password, role, devKey, name }, session) => {
  try {
    // Validate inputs
    if (!email || !password || !isValidRole(role) || !name) {
      throw new ClientError("ValidationError", "Missing required fields");
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new ClientError("ConflictError", "User already exists");
    }

    if (role === ROLES.SUPER_ADMIN) {
      await validateDevKey(devKey).catch((error) => {
        throw new ClientError("InvalidDevKey", error.message);
      });

      await DevKey.updateOne({ key: devKey }, { $set: { isUsed: true } }, { session });
    }

    const Model = role === ROLES.SUPER_ADMIN ? SuperAdmin : HotelOwner;

    // Create user
    const newUser = new Model({
      name,
      email,
      password,
      role,
      isApproved: role === ROLES.SUPER_ADMIN, // SuperAdmin is auto-approved
    });

    if (role === ROLES.HOTEL_OWNER) {
      const newHotel = new Hotel({
        name: `${name}'s Hotel`,
        location: "Default Location",
        ownerId: newUser._id,
      });

      const savedHotel = await newHotel.save({ session });
      newUser.hotelId = savedHotel._id;
    }

    await newUser.save({ session });

    // Generate token
    const token = generateToken(newUser._id, newUser.role);

    return { newUser, token };

  } catch (error) {
    throw new ServerError('Error while creating user');
  }
};

export const authenticateUser = async ({ email, password }) => {
  try {
    // Validate input
    if (!email || !password) {
      throw new ClientError('ValidationError', 'Email and password are required');
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new ClientError('AuthError', 'Invalid credentials');
    }

    // Check approval status for hotel owners
    if (user.role === ROLES.HOTEL_OWNER && !user.isApproved) {
      throw new ClientError('ApprovalError', 'Account not approved by Super Admin');
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ClientError('AuthError', 'Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    return { user, token };
  } catch (error) {
    throw new ServerError('Error while authenticating user');
  }
};