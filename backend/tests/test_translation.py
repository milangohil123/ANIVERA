"""Unit tests for translation module."""
from app.modules.translation.service import translation_service


def test_translation_service_phrase_mapping():
    """Test known seeded phrases translate accurately."""
    # English -> Gujarati
    text_gu, _ = translation_service.translate(
        "Official administrative change",
        target_lang="gu"
    )
    assert text_gu == "સત્તાવાર વહીવટી ફેરફાર"

    # Gujarati -> Hindi
    text_hi, _ = translation_service.translate(
        "સત્તાવાર વહીવટી ફેરફાર",
        target_lang="hi"
    )
    assert text_hi == "आधिकारिक प्रशासनिक परिवर्तन"

    # Hindi -> English
    text_en, _ = translation_service.translate(
        "आधिकारिक प्रशासनिक परिवर्तन",
        target_lang="en"
    )
    assert text_en == "Official administrative change"


def test_translation_service_caching():
    """Test that repeated requests are flagged as cached."""
    text1, is_cached1 = translation_service.translate("Custom phrase testing cache", target_lang="gu")
    assert text1 == "Custom phrase testing cache"
    assert is_cached1 is False

    text2, is_cached2 = translation_service.translate("Custom phrase testing cache", target_lang="gu")
    assert text2 == "Custom phrase testing cache"
    assert is_cached2 is True


def test_empty_string_handling():
    """Test empty string returns empty immediately."""
    assert translation_service.translate("", target_lang="hi")[0] == ""
    assert translation_service.translate("   ", target_lang="gu")[0] == ""
