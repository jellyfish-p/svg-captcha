'use strict';

const colors = {
	blue: {label: '蓝色', rgb: [49, 119, 225]},
	orange: {label: '橙色', rgb: [225, 119, 37]},
	purple: {label: '紫色', rgb: [154, 79, 198]},
	green: {label: '绿色', rgb: [42, 148, 91]},
	gray: {rgb: [120, 120, 120]}
};

const directions = {
	front: {label: '正对着你', angle: 0},
	left: {label: '朝屏幕左侧', angle: -38},
	right: {label: '朝屏幕右侧', angle: 38}
};

const background = [248, 248, 248];

module.exports = {colors, directions, background};
