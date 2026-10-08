import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  AlertCircle,
  Truck,
  Eye,
  EyeOff
} from 'lucide-react';
import { WholesalerProvider, useWholesaler } from '@/context/WholesalerContext';

function RegisterForm() {
  const navigate = useNavigate();
  const { registerWholesaler } = useWholesaler();

  // Form Fields State
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  // Business Address
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Delivery / Pickup Address
  const [sameAsBusinessAddress, setSameAsBusinessAddress] = useState(true);
  const [pickupStreetAddress, setPickupStreetAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupState, setPickupState] = useState('');
  const [pickupPincode, setPickupPincode] = useState('');

  // GST Status Toggle
  const [isGstRegistered, setIsGstRegistered] = useState(true);
  const [gstin, setGstin] = useState('');

  // Password & Confirm Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Inline Validation Errors State
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // 1. Email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    // 2. Mobile number: exactly 10 digits numeric
    if (!/^[0-9]{10}$/.test(phone.trim())) {
      newErrors.phone = 'Mobile number must be exactly 10 numeric digits (e.g. 9820011990).';
    }

    // 3. Business Name & Owner Name
    if (!businessName.trim()) newErrors.businessName = 'Business/Shop name is required.';
    if (!ownerName.trim()) newErrors.ownerName = 'Owner full name is required.';

    // 4. Business Address fields
    if (!streetAddress.trim()) newErrors.streetAddress = 'Street address is required.';
    if (!city.trim()) newErrors.city = 'City is required.';
    if (!state.trim()) newErrors.state = 'State is required.';
    if (!pincode.trim() || !/^[0-9]{6}$/.test(pincode.trim())) {
      newErrors.pincode = 'Pincode must be a 6-digit numeric code.';
    }

    // 5. Delivery/Pickup Address (if not same as business)
    if (!sameAsBusinessAddress) {
      if (!pickupStreetAddress.trim()) newErrors.pickupStreetAddress = 'Pickup street address is required.';
      if (!pickupCity.trim()) newErrors.pickupCity = 'Pickup city is required.';
      if (!pickupState.trim()) newErrors.pickupState = 'Pickup state is required.';
      if (!pickupPincode.trim() || !/^[0-9]{6}$/.test(pickupPincode.trim())) {
        newErrors.pickupPincode = 'Pickup pincode must be a 6-digit numeric code.';
      }
    }

    // 6. GST Number validation (if GST Registered)
    if (isGstRegistered) {
      if (!gstin.trim() || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(gstin.trim())) {
        newErrors.gstin = 'Invalid GST format. Must be a 15-character Indian GSTIN (e.g., 27AAACA12341Z5).';
      }
    }

    // 7. Password: min 6 chars with at least one letter and one number
    if (!/^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password)) {
      newErrors.password = 'Password must be at least 6 characters long and contain at least 1 letter and 1 number.';
    }

    // 8. Confirm Password match
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onlyDigits = (value: string, maxLength: number) => value.replace(/\D/g, '').slice(0, maxLength);
  const onlyLettersSpaces = (value: string, maxLength: number) =>
    value.replace(/[^a-zA-Z\s]/g, '').replace(/\s{2,}/g, ' ').slice(0, maxLength);
  const limitedText = (value: string, maxLength: number) => value.replace(/\s{2,}/g, ' ').slice(0, maxLength);
  const cleanGstin = (value: string) => value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, 15);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await registerWholesaler({
        businessName,
        ownerName,
        email,
        phone,
        isGstRegistered,
        gstin: isGstRegistered ? gstin : 'NON-GST',
        streetAddress,
        city,
        state,
        pincode,
        sameAsBusinessAddress,
        pickupStreetAddress: sameAsBusinessAddress ? streetAddress : pickupStreetAddress,
        pickupCity: sameAsBusinessAddress ? city : pickupCity,
        pickupState: sameAsBusinessAddress ? state : pickupState,
        pickupPincode: sameAsBusinessAddress ? pincode : pickupPincode,
      }, password);

      navigate(`/login?registered=1&email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      const msg = err?.message || 'Registration failed.';
      if (msg.toLowerCase().includes('mobile') || msg.toLowerCase().includes('phone')) {
        setErrors((prev) => ({ ...prev, phone: msg, form: msg }));
      } else if (msg.toLowerCase().includes('email')) {
        setErrors((prev) => ({ ...prev, email: msg, form: msg }));
      } else {
        setErrors((prev) => ({ ...prev, form: msg }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#1F1F1F] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#C62828] text-white flex items-center justify-center shadow-lg font-bold text-2xl">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#1F1F1F]">
          Wholesaler Account Registration
        </h1>
        <p className="mt-1 text-xs text-gray-600">
          Register your wholesale business to manage products, automated stock, and retailer network
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-8 shadow-xl rounded-3xl border border-[#E5E5E5]">
          {errors.form && (
            <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <span>{errors.form}</span>
              </div>
              {errors.form.toLowerCase().includes('already registered') && (
                <Link
                  to={`/login?email=${encodeURIComponent(email)}&mobile=${encodeURIComponent(phone)}`}
                  className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-xl hover:bg-red-700 hover:text-white transition-all font-bold shrink-0 text-xs shadow-xs"
                >
                  Already have an account? Log in
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* Section 1: Basic Contact Information */}
            <div>
              <h2 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider pb-2 border-b border-[#E5E5E5] mb-4">
                1. Basic Contact Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Official Email Address *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      required
                      inputMode="email"
                      autoComplete="email"
                      maxLength={80}
                      value={email}
                      onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                      placeholder="Enter your official email"
                      className={`w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F7] border rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] ${
                        errors.email ? 'border-red-500' : 'border-[#E5E5E5]'
                      }`}
                    />
                  </div>
                  {errors.email && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.email}</span>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Mobile Number (10 Digits) *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(onlyDigits(e.target.value, 10))}
                      placeholder="Enter 10 digit mobile number"
                      className={`w-full pl-10 pr-3.5 py-2.5 bg-[#FAF9F7] border rounded-xl font-mono focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] ${
                        errors.phone ? 'border-red-500' : 'border-[#E5E5E5]'
                      }`}
                    />
                  </div>
                  {errors.phone && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.phone}</span>}
                </div>
              </div>
            </div>

            {/* Section 2: Business & Owner Profile */}
            <div>
              <h2 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider pb-2 border-b border-[#E5E5E5] mb-4">
                2. Business & Owner Profile
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Business / Shop Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={businessName}
                    onChange={(e) => setBusinessName(limitedText(e.target.value, 80))}
                    placeholder="Enter your business or shop name"
                    className={`w-full px-3.5 py-2.5 bg-[#FAF9F7] border rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] ${
                      errors.businessName ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.businessName && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.businessName}</span>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={ownerName}
                    onChange={(e) => setOwnerName(onlyLettersSpaces(e.target.value, 60))}
                    placeholder="Enter owner full name"
                    className={`w-full px-3.5 py-2.5 bg-[#FAF9F7] border rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] ${
                      errors.ownerName ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.ownerName && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.ownerName}</span>}
                </div>
              </div>
            </div>

            {/* Section 3: GST Status Toggle */}
            <div className="p-4 bg-[#FAF9F7] rounded-2xl border border-[#E5E5E5] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-gray-700 uppercase tracking-wider text-[11px]">3. GST Status</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-gray-700">
                    <input
                      type="radio"
                      name="gstStatus"
                      checked={isGstRegistered}
                      onChange={() => setIsGstRegistered(true)}
                      className="accent-[#C62828]"
                    />
                    <span>GST Registered</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-gray-700">
                    <input
                      type="radio"
                      name="gstStatus"
                      checked={!isGstRegistered}
                      onChange={() => setIsGstRegistered(false)}
                      className="accent-[#C62828]"
                    />
                    <span>Non-GST</span>
                  </label>
                </div>
              </div>

              {isGstRegistered ? (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">GST Number (GSTIN) *</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9A-Za-z]{15}"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(cleanGstin(e.target.value))}
                    placeholder="Enter 15 character GSTIN"
                    className={`w-full px-3.5 py-2.5 bg-white border rounded-xl uppercase font-mono focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] ${
                      errors.gstin ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.gstin && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.gstin}</span>}
                </div>
              ) : (
                <div className="p-3 bg-[#FFF8E1] border border-[#FFE082] text-xs text-[#1F1F1F] rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#F9A825] shrink-0" />
                  <span>Note: Non-GST wholesalers can register freely, but may have limited tax invoice feature access later.</span>
                </div>
              )}
            </div>

            {/* Section 4: Business Address */}
            <div className="space-y-3">
              <h2 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider pb-2 border-b border-[#E5E5E5]">
                4. Registered Business Address
              </h2>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Street Address *</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(limitedText(e.target.value, 140))}
                  placeholder="Enter registered business address"
                  className={`w-full px-3.5 py-2.5 bg-[#FAF9F7] border rounded-xl focus:border-[#C62828] ${
                    errors.streetAddress ? 'border-red-500' : 'border-[#E5E5E5]'
                  }`}
                />
                {errors.streetAddress && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.streetAddress}</span>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={city}
                    onChange={(e) => setCity(onlyLettersSpaces(e.target.value, 40))}
                    placeholder="Enter city"
                    className={`w-full px-3 py-2 bg-[#FAF9F7] border rounded-xl ${
                      errors.city ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.city && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.city}</span>}
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={state}
                    onChange={(e) => setState(onlyLettersSpaces(e.target.value, 40))}
                    placeholder="Enter state"
                    className={`w-full px-3 py-2 bg-[#FAF9F7] border rounded-xl ${
                      errors.state ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.state && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.state}</span>}
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Pincode (6 Digits) *</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(onlyDigits(e.target.value, 6))}
                    placeholder="6 digit pincode"
                    className={`w-full px-3 py-2 bg-[#FAF9F7] border rounded-xl font-mono ${
                      errors.pincode ? 'border-red-500' : 'border-[#E5E5E5]'
                    }`}
                  />
                  {errors.pincode && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.pincode}</span>}
                </div>
              </div>
            </div>

            {/* Section 5: Delivery / Product Pickup Address */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                <h2 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#C62828]" />
                  <span>5. Delivery / Product Pickup Address</span>
                </h2>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[#C62828]">
                  <input
                    type="checkbox"
                    checked={sameAsBusinessAddress}
                    onChange={(e) => setSameAsBusinessAddress(e.target.checked)}
                    className="accent-[#C62828] w-4 h-4 rounded"
                  />
                  <span>Same as business address</span>
                </label>
              </div>

              {!sameAsBusinessAddress && (
                <div className="p-4 bg-[#FAF9F7] rounded-2xl border border-[#E5E5E5] space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Pickup Warehouse Street Address *</label>
                    <input
                      type="text"
                      required
                      maxLength={140}
                      value={pickupStreetAddress}
                      onChange={(e) => setPickupStreetAddress(limitedText(e.target.value, 140))}
                      placeholder="Enter warehouse pickup street address"
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl ${
                        errors.pickupStreetAddress ? 'border-red-500' : 'border-[#E5E5E5]'
                      }`}
                    />
                    {errors.pickupStreetAddress && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.pickupStreetAddress}</span>}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">City *</label>
                      <input
                        type="text"
                        required
                        maxLength={40}
                        value={pickupCity}
                        onChange={(e) => setPickupCity(onlyLettersSpaces(e.target.value, 40))}
                        placeholder="Enter pickup city"
                        className={`w-full px-3 py-2 bg-white border rounded-xl ${
                          errors.pickupCity ? 'border-red-500' : 'border-[#E5E5E5]'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">State *</label>
                      <input
                        type="text"
                        required
                        maxLength={40}
                        value={pickupState}
                        onChange={(e) => setPickupState(onlyLettersSpaces(e.target.value, 40))}
                        placeholder="Enter pickup state"
                        className={`w-full px-3 py-2 bg-white border rounded-xl ${
                          errors.pickupState ? 'border-red-500' : 'border-[#E5E5E5]'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Pincode *</label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={pickupPincode}
                        onChange={(e) => setPickupPincode(onlyDigits(e.target.value, 6))}
                        placeholder="6 digit pincode"
                        className={`w-full px-3 py-2 bg-white border rounded-xl font-mono ${
                          errors.pickupPincode ? 'border-red-500' : 'border-[#E5E5E5]'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 6: Password & Confirm Password */}
            <div>
              <h2 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider pb-2 border-b border-[#E5E5E5] mb-4">
                6. Account Password
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Password (Min 6 chars, Letter + Number) *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      maxLength={64}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create password"
                      className={`w-full pl-10 pr-11 py-2.5 bg-[#FAF9F7] border rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] ${
                        errors.password ? 'border-red-500' : 'border-[#E5E5E5]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-white hover:text-[#C62828]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.password}</span>}
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      maxLength={64}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password to confirm"
                      className={`w-full pl-10 pr-11 py-2.5 bg-[#FAF9F7] border rounded-xl focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] ${
                        errors.confirmPassword ? 'border-red-500' : 'border-[#E5E5E5]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-white hover:text-[#C62828]"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className="text-[11px] text-red-600 mt-1 block font-semibold">{errors.confirmPassword}</span>}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E5E5]">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#C62828] text-white text-sm font-bold rounded-xl hover:bg-[#B71C1C] shadow-md transition-all"
              >
                <span>Submit Registration for Admin Approval</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Already registered?{' '}
            <Link to="/login" className="text-[#C62828] font-bold hover:underline">
              Log in to Wholesaler Portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <WholesalerProvider>
      <RegisterForm />
    </WholesalerProvider>
  );
}
