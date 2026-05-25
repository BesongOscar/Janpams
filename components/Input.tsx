import React, { FC, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  InputModeOptions,
  StyleProp,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { Icon, TextInput } from 'react-native-paper';
import { createAddressStyles as styles } from '@/styles';
import { Colors } from '@/constants';
import i18n from '@/i18n';
import { DropdownOption } from '@/interfaces';

type InputComponentProps = {
  title1: string;
  title2?: string;
  optional?: boolean;
  required?: boolean;
  error?: string | undefined;
  showError?: boolean;
  tooltip?: string;
  placeHolder1?: string;
  placeHolder2?: string;
  options1?: Array<DropdownOption>;
  options2?: Array<DropdownOption>;
  inputMode1?: InputModeOptions;
  inputMode2?: InputModeOptions;
  value1: string | undefined;
  value2?: string | undefined;
  // setValue1: Dispatch<SetStateAction<string | undefined>>;
  // eslint-disable-next-line no-unused-vars
  setValue1: (arg0: string | undefined) => void;
  // setValue2?: Dispatch<SetStateAction<string | undefined>>;
  // eslint-disable-next-line no-unused-vars
  setValue2?: (arg0: string | undefined) => void;
  editable?: boolean;
  defaultDisabled?: boolean;
  icon: ImageSourcePropType | undefined;
  rightIcon?: ImageSourcePropType | string | undefined;
  containerStyle?: StyleProp<ViewStyle>;
  toolTipVisible?: boolean;
  onToggleTooltip?: () => void;
  maxLength1?: number;
  maxLength2?: number;
  onPress?: () => void;
  onDone?: () => void;
  isEditing?: boolean;
};

export const InputComponent: FC<InputComponentProps> = ({
  title1,
  title2,
  optional = false,
  required = false,
  error,
  showError,
  icon,
  rightIcon,
  tooltip,
  placeHolder1,
  placeHolder2,
  options1,
  options2,
  value1,
  value2,
  setValue1,
  setValue2,
  editable = false,
  inputMode1 = 'text',
  inputMode2 = 'text',
  defaultDisabled = false,
  containerStyle,
  toolTipVisible = false,
  onToggleTooltip = () => {},
  maxLength1,
  maxLength2,
  onPress,
  onDone,
  isEditing,
}) => {
  const [disabled, setDisabled] = useState(editable);

  const fadeAnim = useRef(new Animated.Value(0)).current; // Initial opacity is 0

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: toolTipVisible ? 1 : 0, // Fade in to 1, fade out to 0
      duration: 300, // 1 second (adjust to 2000 for 2 seconds)
      useNativeDriver: true,
    }).start();
  }, [toolTipVisible]);

  return (
    <TouchableWithoutFeedback onPress={() => onToggleTooltip()}>
      <>
        <View
          style={[
            styles.inputComponentContainer,
            containerStyle && containerStyle,
          ]}>
          <View style={styles.mainInputContainer}>
            <Image source={icon} style={{ width: 20, height: 20 }} />
            <View style={styles.inputContainer}>
              <View style={styles.inputTitleContainer}>
                <Text
                  style={[
                    styles.inputTitle,
                    !(setValue2 && title2) && styles.fullWidth,
                  ]}>
                  {title1}
                  {required && (
                    <Text style={styles.requiredAsterisk}> *</Text>
                  )}
                  {optional && (
                    <Text style={styles.optionalText}> [optional]</Text>
                  )}
                </Text>
                {setValue2 && title2 && (
                  <Text style={styles.inputTitle}>{title2}</Text>
                )}
              </View>
              <View style={styles.inputValueContainer}>
                <View
                  style={setValue2 ? styles.doubleInput : styles.singleInput}>
                  {options1 ? (
                    <Dropdown
                      value={value1}
                      data={options1}
                      style={[styles.input, styles.dropdownInputHeight]}
                      onChange={e => setValue1(e.value)}
                      placeholder={placeHolder1}
                      placeholderStyle={styles.placeholderText}
                      maxHeight={256}
                      itemTextStyle={styles.itemText}
                      renderRightIcon={() => {
                        return value1 ? (
                          <TouchableOpacity
                            onPress={() => setValue1(undefined)}>
                            <Icon
                              source={'close'}
                              color={Colors.dark[0]}
                              size={12}
                            />
                          </TouchableOpacity>
                        ) : (
                          <Image source={require('@/assets/images/ic_dropdown.png')} style={{ width: 13, height: 13 }} />
                        );
                      }}
                      labelField="label"
                      valueField="value"
                      itemContainerStyle={styles.itemContainer}
                      selectedTextStyle={styles.selectedText}
                    />
                  ) : (
                    <TextInput
                      mode="flat"
                      style={styles.input}
                      placeholder={placeHolder1}
                      placeholderTextColor={Colors['grey-93']}
                      value={value1}
                      contentStyle={styles.textInputContent}
                      onChangeText={setValue1}
                      editable={!disabled && !defaultDisabled}
                      activeUnderlineColor="transparent"
                      underlineColor="transparent"
                      inputMode={inputMode1}
                      numberOfLines={1}
                      maxLength={maxLength1}
                      dense
                    />
                  )}
                </View>
                {!!setValue2 && (
                  <View
                    style={[styles.secondInputContainer, styles.doubleInput]}>
                    <Text style={styles.dividerText}>|</Text>
                    {options2 ? (
                      <Dropdown
                        value={value2}
                        data={options2}
                        style={[
                          styles.input,
                          styles.singleInput,
                          styles.dropdownInputHeight,
                        ]}
                        onChange={e => setValue2(e.value)}
                        placeholder={placeHolder2}
                        placeholderStyle={styles.placeholderText}
                        maxHeight={256}
                        itemTextStyle={styles.itemText}
                        renderRightIcon={() => {
                          return value2 ? (
                            <TouchableOpacity
                              onPress={() => setValue2(undefined)}>
                              <Icon
                                source={'close'}
                                color={Colors.dark[0]}
                                size={12}
                              />
                            </TouchableOpacity>
                          ) : (
                            <Icon
                              source={'chevron-down'}
                              color={Colors.dark[0]}
                              size={18}
                            />
                          );
                        }}
                        labelField="label"
                        valueField="value"
                        itemContainerStyle={styles.itemContainer}
                        selectedTextStyle={styles.selectedText}
                      />
                    ) : (
                      <TextInput
                        mode="flat"
                        style={styles.input}
                        placeholder={placeHolder2}
                        placeholderTextColor={Colors['grey-93']}
                        value={value2}
                        contentStyle={styles.textInputContent}
                        onChangeText={setValue2}
                        editable={!disabled && !defaultDisabled}
                        activeUnderlineColor="transparent"
                        underlineColor="transparent"
                        inputMode={inputMode2}
                        numberOfLines={1}
                        maxLength={maxLength2}
                        dense
                      />
                    )}
                  </View>
                )}
              </View>
              {editable && (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    // style={styles.editButton}
                    onPress={() => {
                      onPress?.();
                      setDisabled(prev => !prev);
                      onDone?.();
                    }}>
                      <Image source={require('@/assets/images/ic_edit.png')} style={{ width: 13, height: 13 }} />
                    {/* <Text style={styles.editButtonText}>
                      {typeof isEditing === 'boolean'
                        ? isEditing
                          ? i18n.t('components.input.done')
                          : i18n.t('components.input.edit')
                        : disabled
                          ? i18n.t('components.input.edit')
                          : i18n.t('components.input.done')}
                    </Text> */}
                  </TouchableOpacity>
                </View>
              )}
              {rightIcon && (
                <View style={styles.rightIconContainer}>
                  {typeof rightIcon === 'string' ? (
                    <Text>{rightIcon}</Text>
                  ) : (
                    <Image source={rightIcon} style={styles.rightIcon} />
                  )}
                </View>
              )}
            </View>
          </View>
          {!!tooltip && (
            <>
              <TouchableOpacity
                style={styles.helpIconContainer}
                onPress={() => onToggleTooltip()}>
                <Icon
                  source="help-circle"
                  size={16}
                  color={Colors.primary[500]}
                />
              </TouchableOpacity>

              {/* Tooltip (Now placed outside input fields to avoid overlap) */}
              {toolTipVisible && (
                <Animated.View style={[styles.toolTip, { opacity: fadeAnim }]}>
                  <Text style={styles.tooltipText}>{tooltip}</Text>
                </Animated.View>
              )}
            </>
          )}
        </View>
        {!!error && showError && <Text style={styles.errorText}>{error}</Text>}
      </>
    </TouchableWithoutFeedback>
  );
};
