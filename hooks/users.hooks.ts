/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  usersChangePasswordRequest,
  usersChangePasswordResponse,
  usersChangePinRequest,
  usersChangePinResponse,
  usersConfirmVerificationCodeRequest,
  usersConfirmVerificationCodeResponse,
  usersForgotPasswordRequest,
  usersForgotPasswordResponse,
  usersForgotPinCodeRequest,
  usersForgotPinCodeResponse,
  usersGetUserNotificationsResponse,
  usersGetUserResponse,
  usersLoginRequest,
  usersLoginResponse,
  usersLoginWithGoogleRequest,
  usersLoginWithGoogleResponse,
  usersRefreshTokenRequest,
  usersRefreshTokenResponse,
  usersRegisterUserRequest,
  usersRegisterUserResponse,
  usersResendVerificationRequest,
  usersResendVerificationResponse,
  usersResetPasswordRequest,
  usersResetPasswordResponse,
  usersResetPinCodeRequest,
  usersResetPinCodeResponse,
  usersSocialLoginRequest,
  usersUpdateProfileRequest,
  usersUpdateProfileResponse,
} from '@/interfaces';
import { getSupabase } from '@/lib/supabase/client';
import { mapSupabaseUser } from '@/lib/supabase/mapSupabaseUser';
import { axiosFormDataInstance, axiosInstance } from '@/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';

const registerUser = async (body: usersRegisterUserRequest, lang: string) => {
  const formData = new FormData();
  if (body?.image) {
    formData.append('image', {
      uri: body.image,
      name: 'profile.jpg',
      type: 'image/jpg',
    } as any);
  }
  formData.append('first_name', body?.first_name ?? '');
  formData.append('last_name', body?.last_name ?? '');
  formData.append('email', body?.email ?? '');
  formData.append('phone_number', body?.phone_number ?? '');
  formData.append('username', body?.username ?? '');
  formData.append('password', body?.password ?? '');
  formData.append('pincode', (body?.pincode ?? '')?.toString());

  return (
    await axiosFormDataInstance.post<usersRegisterUserResponse>(
      `/auth/register?lang=${lang}`,
      formData,
    )
  ).data;
};

export function useRegisterUser(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data: usersRegisterUserResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersRegisterUserRequest) => registerUser(body, lang),
    onSuccess,
    onError,
  });
}

const resendVerificationCode = async (
  body: usersResendVerificationRequest,
  lang: string,
) => {
  return (
    await axiosInstance.put<usersResendVerificationResponse>(
      `/auth/code/resend?user_id=${body.id}&channel=${body.channel}&lang=${lang}`,
    )
  ).data;
};

export function useResendVerificationCode(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersResendVerificationResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersResendVerificationRequest) =>
      resendVerificationCode(body, lang),
    onSuccess,
    onError,
  });
}

const confirmVerificationCode = async (
  body: usersConfirmVerificationCodeRequest,
  lang: string,
) => {
  return (
    await axiosInstance.post<usersConfirmVerificationCodeResponse>(
      `/auth/code/verify?lang=${lang}&channel=${body.channel}`,
      body,
    )
  ).data;
};

export function useConfirmVerificationCode(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersConfirmVerificationCodeResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersConfirmVerificationCodeRequest) =>
      confirmVerificationCode(body, lang),
    onSuccess,
    onError,
  });
}

const forgotPincode = async (body: usersForgotPinCodeRequest, lang: string) => {
  return (
    await axiosInstance.get<usersForgotPinCodeResponse>(
      `/auth/forgot/pincode?phone_number=${encodeURIComponent(
        body.phone_number ?? '',
      )}&lang=${lang}`,
    )
  ).data;
};

export function useForgotPinCode(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersForgotPinCodeResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersForgotPinCodeRequest) => forgotPincode(body, lang),
    onSuccess,
    onError,
  });
}

const resetPin = async (body: usersResetPinCodeRequest, lang: string) => {
  return (
    await axiosInstance.post<usersResetPinCodeResponse>(
      `/auth/reset/pincode?lang=${lang}`,
      body,
    )
  ).data;
};

export function useResetPinCode(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersResetPinCodeResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersResetPinCodeRequest) => resetPin(body, lang),
    onSuccess,
    onError,
  });
}

const resetPassword = async (body: usersResetPasswordRequest, lang: string) => {
  return (
    await axiosInstance.post<usersResetPasswordResponse>(
      `/auth/reset/password?lang=${lang}`,
      body,
    )
  ).data;
};

export function useResetPassword(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersResetPasswordResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersResetPasswordRequest) => resetPassword(body, lang),
    onSuccess,
    onError,
  });
}

const forgotPassword = async (
  body: usersForgotPasswordRequest,
  lang: string,
) => {
  return (
    await axiosInstance.get<usersForgotPasswordResponse>(
      `/auth/forgot/password?email=${body.email}&lang=${lang}`,
    )
  ).data;
};

export function useForgotPassword(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersForgotPasswordResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersForgotPasswordRequest) =>
      forgotPassword(body, lang),
    onSuccess,
    onError,
  });
}

const login = async (body: usersLoginRequest, lang: string) => {
  const startTime = Date.now();

  try {
    const response = await axiosInstance.post<usersLoginResponse>(
      `/auth/login?lang=${lang}`,
      body,
    );
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle different types of errors
    if (error instanceof AxiosError) {
      // Network timeout
      if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
        throw new Error(
          `Request timed out after ${duration}ms. The server might be slow or unreachable. Please try again.`,
        );
      }

      // Network error (e.g. no connection, CORS, DNS)
      if (error.code === 'ERR_NETWORK') {
        throw new Error(
          'Network error. Please check your internet connection and try again.',
        );
      }

      // Network connection issues
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error(
          'Unable to connect. Please check your internet connection and try again.',
        );
      }

      // Server responded with error
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 400:
            throw new Error(
              data?.message ||
                'Invalid request. Please check your details and try again.',
            );
          case 401:
            throw new Error('Authentication failed. Please log in again.');
          case 403:
            throw new Error(
              'Access denied. You may not have permission to perform this action.',
            );
          case 404:
            throw new Error(
              'Service not found. Please contact support.',
            );
          case 429:
            throw new Error(
              'Too many requests. Please wait a moment and try again.',
            );
          case 500:
          case 502:
          case 503:
          case 504:
            throw new Error(
              `Server error (${status}). Please try again later or contact support if the problem persists.`,
            );
          default:
            throw new Error(
              data?.message ||
                `Unexpected error (${status}). Please try again.`,
            );
        }
      }

      // Request was made but no response received
      if (error.request) {
        throw new Error(
          'No response from server. Please check your internet connection and try again.',
        );
      }
    }

    // Interceptor may have already converted Axios errors to plain Error (e.g. ERR_NETWORK → "Network connection failed...")
    if (error instanceof Error && error.message) {
      throw error;
    }

    // Generic error fallback
    throw new Error(
      'An unexpected error occurred while signing in. Please try again.',
    );
  }
};

export function useLogin(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersLoginResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersLoginRequest) => login(body, lang),
    onSuccess,
    onError,
  });
}

const updateProfile = async (body: usersUpdateProfileRequest, lang: string) => {
  const formData = new FormData();
  if (body?.image) {
    formData.append('image', {
      uri: body.image,
      name: 'profile.jpg',
      type: 'image/jpeg',
    } as any);
  }
  formData.append('first_name', body.first_name ?? '');
  formData.append('middle_names', body.middle_names ?? '');
  formData.append('last_name', body.last_name ?? '');
  formData.append('phone_number', body.phone_number ?? '');
  formData.append('username', body.username ?? '');
  formData.append('email_address', body.email_address ?? '');
  formData.append('pincode', body.pincode ?? '');
  formData.append('code', body.code ?? '');
  formData.append('password', body.password ?? '');
  formData.append('new_password', body.new_password ?? '');
  formData.append('new_pincode', body.new_pincode ?? '');

  return (
    await axiosFormDataInstance.post<usersUpdateProfileResponse>(
      `/user/profile/update?lang=${lang}`,
      formData,
    )
  ).data;
};

export function useUpdateProfile(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersUpdateProfileResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersUpdateProfileRequest) => updateProfile(body, lang),
    onSuccess,
    onError,
  });
}

const changePin = async (body: usersChangePinRequest, lang: string) => {
  return (
    await axiosInstance.post<usersChangePinResponse>(
      `/user/change/pincode?lang=${lang}`,
      body,
    )
  ).data;
};

export function useChangePinCode(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersChangePinResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersChangePinRequest) => changePin(body, lang),
    onSuccess,
    onError,
  });
}

const changePassword = async (
  body: usersChangePasswordRequest,
  lang: string,
) => {
  return (
    await axiosInstance.post<usersChangePasswordResponse>(
      `/user/change/password?lang=${lang}`,
      body,
    )
  ).data;
};

export function useChangePassword(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersChangePasswordResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersChangePasswordRequest) =>
      changePassword(body, lang),
    onSuccess,
    onError,
  });
}

const socialLogin = async (body: usersSocialLoginRequest, lang: string) => {
  const res = await axiosInstance.post<usersLoginWithGoogleResponse>(
    `/auth/login/social?lang=${lang}`,
    body,
  );
  return res.data;
};

export function useSocialLogin(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersLoginWithGoogleResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersSocialLoginRequest) => socialLogin(body, lang),
    onSuccess,
    onError,
  });
}

const loginWithGoogle = async (
  body: usersLoginWithGoogleRequest,
  lang: string,
) => {
  const res = await axiosInstance.post<usersLoginWithGoogleResponse>(
    `/auth/login/google?lang=${lang}`,
    body,
  );
  return res.data;
};

export function useLoginWithGoogle(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersLoginWithGoogleResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersLoginWithGoogleRequest) =>
      loginWithGoogle(body, lang),
    onSuccess,
    onError,
  });
}

export interface DeleteAccountRequest {
  /** Required when user has email auth (web parity: delete with password). */
  password?: string;
  /** Required when user has phone auth (web parity: delete with pin). */
  pincode?: string;
}

const deleteAccount = async (lang: string, body?: DeleteAccountRequest) => {
  return (
    await axiosInstance.delete<string>(`user/delete?lang=${lang}`, {
      data: body ?? undefined,
    })
  ).data;
};

export function useDeleteAccount(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (message?: string) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body?: DeleteAccountRequest) => deleteAccount(lang, body),
    onSuccess,
    onError,
  });
}

/**
 * Offline-first: notifications from local (no Laravel API).
 * Auth is Supabase; returns empty list to avoid 401.
 */
async function getLocalUserNotifications(
  _lang: string,
): Promise<usersGetUserNotificationsResponse> {
  return { data: [], current_page: 1 };
}

export function useGetUserNotifications(lang: string, enabled?: boolean) {
  return useQuery({
    queryFn: () => getLocalUserNotifications(lang),
    queryKey: ['/user/notifications'],
    enabled,
  });
}

/**
 * Get current user from Supabase session (no Laravel API).
 * Auth is handled by Supabase; avoids 401 from GET /user.
 */
async function getUserFromSupabase(_lang: string): Promise<usersGetUserResponse> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, user: undefined };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { success: false, user: undefined };
  }
  return { success: true, user: mapSupabaseUser(session.user) };
}

export function useGetUser(lang: string, enabled?: boolean) {
  return useQuery({
    queryFn: () => getUserFromSupabase(lang),
    queryKey: ['/user'],
    enabled,
  });
}

const refreshToken = async (body: usersRefreshTokenRequest, lang: string) => {
  return (
    await axiosInstance.post<usersRefreshTokenResponse>(
      `auth/refresh?lang=${lang}`,
      body,
    )
  ).data;
};

export function useRefreshToken(
  lang: string,
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (data?: usersRefreshTokenResponse) => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: (body: usersRefreshTokenRequest) => refreshToken(body, lang),
    onSuccess,
    onError,
  });
}

const logout = async (lang: string) => {
  return (await axiosInstance.post(`/auth/logout?lang=${lang}`)).data;
};

export function useLogout(
  lang: string,
  onSuccess?: () => void,
  // eslint-disable-next-line no-unused-vars
  onError?: (error?: any) => void,
) {
  return useMutation({
    mutationFn: () => logout(lang),
    onSuccess,
    onError,
  });
}
