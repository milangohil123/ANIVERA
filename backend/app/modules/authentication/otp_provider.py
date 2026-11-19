"""Pluggable OTP Provider Interface and Implementations.

Follows Step 3 requirements:
- Pluggable interface (BaseOTPProvider)
- Simulated implementation (SimulatedOTPProvider) that avoids fake external SMS gateways
  while enabling secure development, testing, and debugging.
- No hardcoded fixed OTP in production mode.
"""
import abc
import logging
from typing import Dict, Optional
from app.core.config import settings

logger = logging.getLogger("pashurakshak.auth.otp")


class BaseOTPProvider(abc.ABC):
    """Abstract base class for SMS/OTP dispatch providers."""

    @abc.abstractmethod
    async def send_otp(self, mobile_e164: str, otp_code: str) -> bool:
        """Send an OTP code to the given E.164 mobile number.
        
        Args:
            mobile_e164: Destination phone number in E.164 format (+919876543210)
            otp_code: Generated numerical OTP code
            
        Returns:
            bool: True if dispatch succeeded, False otherwise
        """
        pass


class SimulatedOTPProvider(BaseOTPProvider):
    """Simulated OTP provider for local development, staging, and automated tests."""

    def __init__(self) -> None:
        self._sent_otps: Dict[str, str] = {}

    async def send_otp(self, mobile_e164: str, otp_code: str) -> bool:
        """Store OTP in memory buffer and log dispatch for testing."""
        self._sent_otps[mobile_e164] = otp_code
        logger.info(
            "[SIMULATED SMS] Dispatched OTP %s to %s",
            otp_code,
            mobile_e164
        )
        return True

    def get_last_otp(self, mobile_e164: str) -> Optional[str]:
        """Retrieve the last sent OTP for integration test assertions."""
        return self._sent_otps.get(mobile_e164)

    def clear(self) -> None:
        """Clear recorded OTPs."""
        self._sent_otps.clear()


# Global simulated singleton for memory retention during local dev / test runner
_simulated_provider_instance: Optional[SimulatedOTPProvider] = None


def get_otp_provider() -> BaseOTPProvider:
    """Factory dependency returning configured OTP provider."""
    global _simulated_provider_instance
    provider_mode = settings.SMS_PROVIDER_MODE.upper()

    if provider_mode == "SIMULATED":
        if _simulated_provider_instance is None:
            _simulated_provider_instance = SimulatedOTPProvider()
        return _simulated_provider_instance
    
    # Future production gateway adapters (CDAC / NIC SMS Gateway) would be instantiated here
    raise NotImplementedError(
        f"OTP provider mode '{settings.SMS_PROVIDER_MODE}' is not yet configured for production."
    )

